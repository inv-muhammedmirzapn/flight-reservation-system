from rest_framework.renderers import JSONRenderer

class StandardizedJSONRenderer(JSONRenderer):
    """
    Standardize all API responses into a consistent envelope format:
    Success:
    {
        "status": "success",
        "message": "...",  # optional
        "data": { ... }    # optional
    }
    
    Error format is handled by custom_exception_handler.
    """
    
    def render(self, data, accepted_media_type=None, renderer_context=None):
        if renderer_context:
            view = renderer_context.get('view')
            response = renderer_context.get('response')
            
            # Skip Swagger/OpenAPI schema views
            if view and view.__class__.__name__ == 'SpectacularAPIView':
                return super().render(data, accepted_media_type, renderer_context)
                
            status_code = response.status_code if response else 200

            # 204 No Content must have NO body — return empty bytes immediately
            if status_code == 204:
                return b''
            
            # If data is already in the standardized envelope (from exception handler or manually built), don't double wrap
            if isinstance(data, dict) and 'status' in data and data['status'] in ['success', 'error']:
                return super().render(data, accepted_media_type, renderer_context)
                
            # If it's a >=400 that bypassed the exception handler (e.g. manual Response)
            if status_code >= 400:
                message = "An error occurred."
                errors = None
                
                if isinstance(data, dict):
                    data = data.copy()
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
                    if data:
                        errors = data
                elif isinstance(data, list) and len(data) > 0 and isinstance(data[0], str):
                    message = data[0]
                elif isinstance(data, str):
                    message = data
                    
                formatted_data = {
                    "status": "error",
                    "message": str(message)
                }
                if errors:
                    formatted_data["errors"] = errors
                    
                return super().render(formatted_data, accepted_media_type, renderer_context)
                
            else:
                # Success wrapper
                message = None
                payload_data = data
                
                if isinstance(data, dict):
                    data = data.copy()
                    # Only extract message/detail if it's explicitly one of those keys and we don't have other data, 
                    # OR if we want to extract it and leave the rest as data.
                    if 'message' in data:
                        message = data.pop('message')
                    elif 'detail' in data:
                        message = data.pop('detail')
                    
                    # If data is empty after popping message, set payload_data to None
                    if not data:
                        payload_data = None
                    else:
                        payload_data = data
                        
                formatted_data = {
                    "status": "success",
                    "data": payload_data
                }
                if message:
                    formatted_data["message"] = str(message)
                    
                return super().render(formatted_data, accepted_media_type, renderer_context)

        return super().render(data, accepted_media_type, renderer_context)
