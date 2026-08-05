from rest_framework.views import exception_handler
from rest_framework.response import Response

def custom_exception_handler(exc, context):
    """
    Standardize all DRF API exceptions into a consistent envelope.
    """
    response = exception_handler(exc, context)

    if response is not None:
        message = "An error occurred."
        errors = None
        data = response.data

        # Flatten list of non_field_errors or detail
        if isinstance(data, dict):
            # Many times DRF puts the message in 'detail'
            if 'detail' in data:
                message = data.pop('detail')
            elif 'error' in data:
                message = data.pop('error')
            elif 'message' in data:
                message = data.pop('message')
            elif 'non_field_errors' in data:
                message = data.pop('non_field_errors')
                if isinstance(message, list) and len(message) > 0:
                    message = message[0]
            
            # Anything left over is field-specific validation errors
            if data:
                errors = data
        elif isinstance(data, list):
            if len(data) > 0 and isinstance(data[0], str):
                message = data[0]
            else:
                errors = data
        elif isinstance(data, str):
            message = data
            
        custom_data = {
            "status": "error",
            "message": str(message)
        }
        if errors:
            custom_data["errors"] = errors
            
        response.data = custom_data

    return response
