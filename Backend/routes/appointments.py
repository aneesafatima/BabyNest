import sqlite3
from flask import Blueprint, jsonify, request
from db.db import open_db, close_db
from error_handling.handlers import handle_db_errors
from error_handling.error_classes import MissingFieldError, NotFoundError

appointments_bp = Blueprint('appointments', __name__)

@appointments_bp.route('/get_appointments', methods=['GET'])
@handle_db_errors
def get_appointments():
    db = open_db()
    appointments = db.execute('SELECT * FROM appointments').fetchall()
    appointments_list = [dict(appt) for appt in appointments]
        
    return jsonify(appointments_list), 200
    

@appointments_bp.route('/get_appointment/<int:appointment_id>', methods=['GET'])
@handle_db_errors
def get_appointment(appointment_id):
    db = open_db()
    if not appointment_id:
        return jsonify({"error": "Appointment ID is required"}), 400
    
    appointment = db.execute('SELECT * FROM appointments WHERE id = ?', (appointment_id,)).fetchone()
    if not appointment:
        raise NotFoundError(resource="Appointment entry", resource_id=appointment_id)
        
    return jsonify(dict(appointment)), 200
    

@appointments_bp.route('/add_appointment', methods=['POST'])
@handle_db_errors
def add_appointment():
    db = open_db()
    data = request.get_json()
    required = ['title', 'content', 'appointment_date', 'appointment_time', 'appointment_location']
    missing = [field for field in required if field not in data]
    if missing:
        raise MissingFieldError(missing)
    
    db.execute(
        'INSERT INTO appointments (title, content, appointment_date, appointment_time, appointment_location, appointment_status) VALUES (?, ?, ?, ?, ?, ?)',
        (data["title"], data["content"], data["appointment_date"], data["appointment_time"], data["appointment_location"], 'pending')
    )
    db.commit()
    return jsonify({"status": "success", "message": "Appointment added successfully"}), 200


@appointments_bp.route('/update_appointment/<int:appointment_id>', methods=['PUT'])
@handle_db_errors
def update_appointment(appointment_id):
    db = open_db()

    existing_appointment = db.execute('SELECT * FROM appointments WHERE id = ?', (appointment_id,)).fetchone()
    if not existing_appointment:
       raise NotFoundError(resource="Appointment entry", resource_id=appointment_id)
    data = request.get_json() #fix invalid json format checking
    required = ['title', 'content', 'appointment_date', 'appointment_time', 'appointment_location']
    missing = [field for field in required if field not in data]
    if missing:
        raise MissingFieldError(missing)
    
    db.execute(
        'UPDATE appointments SET title = ?, content = ?, appointment_date = ?, appointment_time = ?, appointment_location = ?, appointment_status = ? WHERE id = ?',
        (data["title"], data["content"], data["appointment_date"], data["appointment_time"], data["appointment_location"], data.get('appointment_status', 'pending'))
    )
    db.commit()
    return jsonify({"status": "success", "message": "Appointment updated successfully"}), 200


@appointments_bp.route('/delete_appointment/<int:appointment_id>', methods=['DELETE'])
@handle_db_errors
def delete_appointment(appointment_id):
    db = open_db()
    existing_appointment = db.execute('SELECT * FROM appointments WHERE id = ?', (appointment_id,)).fetchone()
    if not existing_appointment:
        raise NotFoundError(resource="Appointment entry", resource_id=appointment_id)
    db.execute('DELETE FROM appointments WHERE id = ?', (appointment_id,))
    db.commit()
    return jsonify({"status": "success", "message": "Appointment deleted successfully"}), 200
