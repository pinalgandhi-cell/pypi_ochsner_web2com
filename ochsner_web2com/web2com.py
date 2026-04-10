import re
import xml.etree.ElementTree as ET
from enum import Enum

import requests
import xmltodict


class HEAT_PUMP(Enum):
    State_heat_generator_control = [1, 125, 0]
    Flow_temperature_heat_generator = [1, 125, 1]
    Return_flow_temperature_heat_generator = [1, 125, 2]
    Heat_source_outlet_temperature = [1, 125, 3]
    Heat_source_inlet_temperature = [1, 125, 4]
    Operation_cycles = [1, 125, 5]
    Operation_hours = [1, 125, 6]
    Volume_flow_heat_energy = [1, 125, 7]
    Flow_rate_heat_source = [1, 125, 8]
    Thermal_energy_kWh = [1, 125, 9]
    Thermal_energy_MWh = [1, 125, 10]
    Energy_DHW_kWh = [1, 125, 11]
    Energy_DHW_MWh = [1, 125, 12]


class AUXILIARY(Enum):
    State_heat_generator_control = [2, 126, 0]
    Flow_temperature_heat_generator = [2, 126, 1]
    Operation_cycles = [2, 126, 2]
    Operation_hours = [2, 126, 3]
    Thermal_energy_kWh = [2, 126, 4]
    Thermal_energy_MWh = [2, 126, 5]


class HEATING_CIRCUIT(Enum):
    State_heating_circuit_control = [4, 119, 0]
    Outdoor_temperature = [4, 119, 1]
    Outdoor_temperature_average_value = [4, 119, 2]
    Setpoint_room_temperature = [4, 119, 3]
    Actual_heating_circuit_flow_temperature = [4, 119, 4]
    Setpoint_heating_circuit_flow_temperature = [4, 119, 5]
    Normal_setpoint_room_temperature_heating = [4, 99, 6]


class DHW(Enum):
    State_DHW_control = [7, 121, 0]
    Actual_DHW_temperature = [7, 121, 1]
    DHW_setpoint = [7, 121, 2]


class MANAGER(Enum):
    Storage_tank_temperature_top = [8, 122, 0]
    Storage_tank_temperature_center = [8, 122, 1]
    Plant_flow_temperature = [8, 122, 2]
    Plant_CH_setpoint_flow_temperature = [8, 122, 3]
    Heating_power_in_heating_mode = [8, 122, 4]
    Heating_power_in_DHW_mode = [8, 122, 5]
    State_heating_manager = [8, 122, 6]


class AUTH(Enum):
    BASIC = 0
    DIGEST = 1


class Web2ComError(Exception):
    pass


class InvalidCommandIdError(Web2ComError):
    pass


class AuthenticationError(Web2ComError):
    pass


class RequestTimeoutError(Web2ComError):
    pass


class HttpError(Web2ComError):
    def __init__(self, status_code, message):
        super().__init__(message)
        self.status_code = status_code


class ResponseParseError(Web2ComError):
    pass


class SoapFaultError(Web2ComError):
    def __init__(self, fault_code, fault_string):
        message = fault_string
        if fault_code:
            message = f'{fault_code}: {fault_string}'
        super().__init__(message)
        self.fault_code = fault_code
        self.fault_string = fault_string


class Service:
    DEFAULT_TIMEOUT = 10
    _INTEGER_PATTERN = re.compile(r'^[+-]?\d+$')
    _FLOAT_PATTERN = re.compile(
        r'^[+-]?(?:\d+\.\d*|\d*\.\d+|\d+)(?:[eE][+-]?\d+)?$'
    )

    def __init__(
        self,
        ip_number: str,
        user_name: str,
        password: str,
        auth=AUTH.DIGEST,
        timeout=DEFAULT_TIMEOUT,
        session=None,
        **kwargs,
    ):
        if not isinstance(ip_number, str) or not ip_number.strip():
            raise ValueError('IP number must be defined')
        if not isinstance(user_name, str) or not user_name.strip():
            raise ValueError('User name must be defined')
        if not isinstance(password, str) or not password:
            raise ValueError('Password must be defined')
        if not isinstance(auth, AUTH):
            raise ValueError('Authentication method must be defined as an AUTH value')
        if not isinstance(timeout, (int, float)) or timeout <= 0:
            raise ValueError('Timeout must be a positive number')

        self.ip_number = ip_number.strip()
        self.user_name = user_name
        self.password = password
        self.auth = auth
        self.timeout = timeout

        self.chain_separator = '/'
        self.chain_seperator = self.chain_separator

        self.eBus_id = 1
        self.device_id = 2

        self.session = session or requests.Session()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()

    def close(self):
        self.session.close()

    def set_eBus_id(self, eBus=1):
        self.eBus_id = self._validate_bus_or_device_id(eBus, 'eBus')

    def set_device_id(self, device=2):
        self.device_id = self._validate_bus_or_device_id(device, 'device')

    def get_auth_method(self):
        if self.auth == AUTH.DIGEST:
            return requests.auth.HTTPDigestAuth(self.user_name, self.password)
        return requests.auth.HTTPBasicAuth(self.user_name, self.password)

    def get_value(self, command_id_sequence):
        command_path = self._normalize_command_path(command_id_sequence)
        payload = self._build_get_payload(command_path)
        response = self._send_request(payload)
        body = self._parse_soap_body(response.content)
        get_response = self._require_child(body, 'getDpResponse')
        dp_config = self._require_child(get_response, 'dpCfg')
        raw_value = self._require_child(dp_config, 'value')
        return (response.status_code, self._parse_value(raw_value))

    def set_value(self, command_id_sequence, command_value):
        command_path = self._normalize_command_path(command_id_sequence)
        payload = self._build_set_payload(command_path, command_value)
        response = self._send_request(payload)
        self._parse_soap_body(response.content)
        return (response.status_code, command_value)

    def get_chain_id(self, enum_id_list):
        path_segments = self._normalize_parameter_id(enum_id_list)
        all_segments = [str(self.eBus_id), str(self.device_id)] + path_segments
        return self.chain_separator + self.chain_separator.join(all_segments)

    def get(self, enum_id):
        return self.get_value(self.get_chain_id(enum_id))

    def set(self, enum_id, command_value):
        return self.set_value(self.get_chain_id(enum_id), command_value)

    def _validate_bus_or_device_id(self, value, label):
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError(f'{label} id must be a non-negative integer')
        return value

    def _normalize_parameter_id(self, enum_id):
        raw_value = enum_id.value if isinstance(enum_id, Enum) else enum_id
        if not isinstance(raw_value, (list, tuple)) or not raw_value:
            raise InvalidCommandIdError(
                'Parameter ids must be a non-empty list, tuple, or Enum value'
            )

        normalized = []
        for segment in raw_value:
            if isinstance(segment, bool) or not isinstance(segment, int) or segment < 0:
                raise InvalidCommandIdError(
                    'Parameter id segments must be non-negative integers'
                )
            normalized.append(str(segment))
        return normalized

    def _normalize_command_path(self, command_id_sequence):
        if not isinstance(command_id_sequence, str):
            raise InvalidCommandIdError('Command id must be provided as a string path')

        segments = [segment for segment in command_id_sequence.split('/') if segment]
        if len(segments) < 5:
            raise InvalidCommandIdError(
                'Command id must contain at least eBus, device, datapoint group, datapoint, and index'
            )
        if any(not segment.isdigit() for segment in segments):
            raise InvalidCommandIdError('Command id segments must all be numeric')
        return self.chain_separator + self.chain_separator.join(segments)

    def _build_get_payload(self, command_path):
        return self._build_envelope(
            'ns:getDpRequest',
            [
                ('ref', [('oid', command_path), ('prop', None)]),
                ('startIndex', '0'),
                ('count', '20'),
            ],
        )

    def _build_set_payload(self, command_path, command_value):
        command_index = command_path.split(self.chain_separator)[-1]
        return self._build_envelope(
            'ns:writeDpRequest',
            [
                ('ref', [('oid', command_path), ('prop', None)]),
                (
                    'dp',
                    [
                        ('index', command_index),
                        ('name', None),
                        ('prop', None),
                        ('desc', None),
                        ('value', self._stringify_value(command_value)),
                        ('unit', None),
                        ('timestamp', '0'),
                    ],
                ),
            ],
        )

    def _build_envelope(self, request_name, children):
        envelope = ET.Element(
            'SOAP-ENV:Envelope',
            {
                'xmlns:SOAP-ENV': 'http://schemas.xmlsoap.org/soap/envelope/',
                'xmlns:SOAP-ENC': 'http://schemas.xmlsoap.org/soap/encoding/',
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'xmlns:ns': 'http://ws01.lom.ch/soap/',
            },
        )
        body = ET.SubElement(envelope, 'SOAP-ENV:Body')
        request = ET.SubElement(body, request_name)
        self._append_xml_children(request, children)
        return ET.tostring(envelope, encoding='utf-8', xml_declaration=True)

    def _append_xml_children(self, parent, children):
        for tag, value in children:
            element = ET.SubElement(parent, tag)
            if isinstance(value, list):
                self._append_xml_children(element, value)
                continue
            if value is not None:
                element.text = value

    def _send_request(self, payload):
        url = f'http://{self.ip_number}/ws'
        try:
            response = self.session.post(
                url,
                data=payload,
                auth=self.get_auth_method(),
                timeout=self.timeout,
            )
        except requests.exceptions.Timeout as exc:
            raise RequestTimeoutError(
                f'Request to {url} timed out after {self.timeout} seconds'
            ) from exc
        except requests.exceptions.ConnectionError as exc:
            raise Web2ComError(f'Unable to connect to {url}') from exc
        except requests.exceptions.RequestException as exc:
            raise Web2ComError(f'Failed to call {url}') from exc

        if response.status_code in (401, 403):
            raise AuthenticationError(
                f'Authentication failed with status code {response.status_code}'
            )
        if response.status_code >= 400:
            raise HttpError(
                response.status_code,
                f'HTTP request failed with status code {response.status_code}',
            )

        return response

    def _parse_soap_body(self, payload):
        if not payload:
            raise ResponseParseError('Empty SOAP response')

        try:
            document = xmltodict.parse(payload)
        except Exception as exc:
            raise ResponseParseError('Malformed SOAP response') from exc

        envelope = self._require_child(document, 'Envelope')
        body = self._require_child(envelope, 'Body')
        fault = self._find_child(body, 'Fault')
        if fault is not None:
            fault_code = self._find_text(fault, 'faultcode', default='')
            fault_string = self._find_text(fault, 'faultstring', default='SOAP fault')
            raise SoapFaultError(fault_code, fault_string)
        return body

    def _require_child(self, mapping, local_name):
        child = self._find_child(mapping, local_name)
        if child is None:
            raise ResponseParseError(f'Missing "{local_name}" in SOAP response')
        return child

    def _find_child(self, mapping, local_name):
        if not isinstance(mapping, dict):
            return None

        for key, value in mapping.items():
            if key.split(':')[-1] == local_name:
                return value
        return None

    def _find_text(self, mapping, local_name, default=None):
        value = self._find_child(mapping, local_name)
        if value is None:
            return default
        if isinstance(value, dict):
            raise ResponseParseError(f'Expected text value for "{local_name}"')
        return str(value)

    def _parse_value(self, value):
        if value is None:
            return None

        if isinstance(value, (int, float, bool)):
            return value

        text = str(value).strip()
        if not text:
            return ''

        lowered = text.lower()
        if lowered == 'true':
            return True
        if lowered == 'false':
            return False
        if self._INTEGER_PATTERN.match(text):
            return int(text)
        if self._FLOAT_PATTERN.match(text):
            return float(text)
        return text

    def _stringify_value(self, value):
        if isinstance(value, bool):
            return str(value).lower()
        return str(value)


if __name__ == '__main__':
    w2c = Service('192.168.188.50', 'OEM', 'password')

    w2c.set_eBus_id(1)
    w2c.set_device_id(2)

    print(w2c.get_value('/1/2/1/125/9'))
    print(w2c.set_value('/1/2/4/99/6', 20.0))
    print(w2c.get(HEAT_PUMP.Thermal_energy_kWh))
    print(w2c.set(HEATING_CIRCUIT.Normal_setpoint_room_temperature_heating, 20.0))
    print(w2c.get([1, 125, 9]))
    print(w2c.set([4, 99, 6], 20.0))

    w2c_basic = Service('192.168.188.50', 'OEM', 'password', auth=AUTH.BASIC)
    print(w2c_basic.get_value('/1/2/1/125/9'))
