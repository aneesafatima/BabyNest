
def validate_bp_data(data):
    errors = {}
    if not isinstance(data['week_number'], int) or data['week_number'] < 1:
            errors["week_number"] = "week_number must be a positive integer."

    if not isinstance(data['systolic'], int) or not (50 < data['systolic'] < 300):
            errors["systolic"] = "systolic must be an integer between 50 and 300."

    if not isinstance(data['diastolic'], int) or not (30 < data['diastolic'] < 200):
            errors["diastolic"] = "diastolic must be an integer between 30 and 200."
    

    return errors