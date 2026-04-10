import unittest

import requests

from ochsner_web2com.web2com import (
    AUTH,
    HEAT_PUMP,
    AuthenticationError,
    InvalidCommandIdError,
    RequestTimeoutError,
    Service,
    SoapFaultError,
)


GET_RESPONSE_TEMPLATE = b'''<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <ns:getDpResponse xmlns:ns="http://ws01.lom.ch/soap/">
      <dpCfg>
        <value>%s</value>
      </dpCfg>
    </ns:getDpResponse>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>
'''

WRITE_RESPONSE = b'''<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <ns:writeDpResponse xmlns:ns="http://ws01.lom.ch/soap/" />
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>
'''

SOAP_FAULT_RESPONSE = b'''<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <SOAP-ENV:Fault>
      <faultcode>SOAP-ENV:Client</faultcode>
      <faultstring>Invalid datapoint</faultstring>
    </SOAP-ENV:Fault>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>
'''


class DummyResponse:
    def __init__(self, status_code=200, content=b''):
        self.status_code = status_code
        self.content = content


class RecordingSession:
    def __init__(self, response=None, error=None):
        self.response = response
        self.error = error
        self.calls = []
        self.closed = False

    def post(self, url, data, auth, timeout):
        self.calls.append(
            {
                'url': url,
                'data': data,
                'auth': auth,
                'timeout': timeout,
            }
        )
        if self.error is not None:
            raise self.error
        return self.response

    def close(self):
        self.closed = True


class ServiceTests(unittest.TestCase):
    def test_get_chain_id_supports_enum_and_list_inputs(self):
        service = Service('192.168.1.10', 'OEM', 'secret', session=RecordingSession())

        self.assertEqual('/1/2/1/125/9', service.get_chain_id(HEAT_PUMP.Thermal_energy_kWh))
        self.assertEqual('/1/2/4/99/6', service.get_chain_id([4, 99, 6]))

    def test_get_value_parses_numeric_boolean_and_string_values(self):
        float_session = RecordingSession(
            response=DummyResponse(200, GET_RESPONSE_TEMPLATE % b'20.5')
        )
        float_service = Service('192.168.1.10', 'OEM', 'secret', session=float_session)
        self.assertEqual((200, 20.5), float_service.get_value('/1/2/1/125/9'))

        bool_session = RecordingSession(
            response=DummyResponse(200, GET_RESPONSE_TEMPLATE % b'true')
        )
        bool_service = Service('192.168.1.10', 'OEM', 'secret', session=bool_session)
        self.assertEqual((200, True), bool_service.get_value('/1/2/1/125/0'))

        string_session = RecordingSession(
            response=DummyResponse(200, GET_RESPONSE_TEMPLATE % b'heating')
        )
        string_service = Service('192.168.1.10', 'OEM', 'secret', session=string_session)
        self.assertEqual((200, 'heating'), string_service.get_value('/1/2/1/125/0'))

    def test_set_value_uses_full_final_segment_for_multi_digit_indexes(self):
        session = RecordingSession(response=DummyResponse(200, WRITE_RESPONSE))
        service = Service('192.168.1.10', 'OEM', 'secret', session=session)

        result = service.set_value('/1/2/1/125/10', 42)

        self.assertEqual((200, 42), result)
        self.assertIn(b'<index>10</index>', session.calls[0]['data'])

    def test_timeout_is_forwarded_and_raises_typed_error(self):
        session = RecordingSession(error=requests.exceptions.Timeout('timeout'))
        service = Service(
            '192.168.1.10',
            'OEM',
            'secret',
            timeout=3,
            session=session,
        )

        with self.assertRaises(RequestTimeoutError):
            service.get_value('/1/2/1/125/9')

        self.assertEqual(3, session.calls[0]['timeout'])

    def test_authentication_failures_raise_authentication_error(self):
        session = RecordingSession(response=DummyResponse(401, b'Unauthorized'))
        service = Service('192.168.1.10', 'OEM', 'secret', session=session)

        with self.assertRaises(AuthenticationError):
            service.get_value('/1/2/1/125/9')

    def test_soap_faults_raise_typed_error(self):
        session = RecordingSession(response=DummyResponse(200, SOAP_FAULT_RESPONSE))
        service = Service('192.168.1.10', 'OEM', 'secret', session=session)

        with self.assertRaises(SoapFaultError) as context:
            service.get_value('/1/2/1/125/9')

        self.assertIn('Invalid datapoint', str(context.exception))

    def test_invalid_command_paths_are_rejected_before_request(self):
        session = RecordingSession(response=DummyResponse(200, GET_RESPONSE_TEMPLATE % b'1'))
        service = Service('192.168.1.10', 'OEM', 'secret', session=session)

        with self.assertRaises(InvalidCommandIdError):
            service.get_value('/1/2/1/not-a-number')

        self.assertEqual([], session.calls)

    def test_basic_auth_can_be_selected(self):
        session = RecordingSession(response=DummyResponse(200, GET_RESPONSE_TEMPLATE % b'1'))
        service = Service(
            '192.168.1.10',
            'OEM',
            'secret',
            auth=AUTH.BASIC,
            session=session,
        )

        service.get_value('/1/2/1/125/9')

        self.assertEqual('HTTPBasicAuth', type(session.calls[0]['auth']).__name__)


if __name__ == '__main__':
    unittest.main()
