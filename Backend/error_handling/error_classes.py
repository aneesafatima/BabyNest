from flask import jsonify, current_app


class Mode:
    mode = current_app.config.get('ENV', 'development')  # Default to development if not set


class MissingFieldError(Exception, Mode):
    """Exception raised when a required field is missing in the input data."""
    status_code = 400
    def __init__(self, field_names: list):
        self.field_names = field_names
        self.message = f"Missing required fields: {', '.join(field_names)}" if self.mode == 'development' else "Required fields are missing."
        
    
class NotFoundError(Exception, Mode):
    status_code = 404

    def __init__(self, resource="Resource", resource_id=None):
        self.resource = resource
        self.resource_id = resource_id
        if self.mode == "development" and resource_id is not None:
            self.message = f"{resource} with ID {resource_id} not found"
        else:
            self.message = f"{resource} not found"