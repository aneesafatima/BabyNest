import React, { useState } from "react";
import { View, Text, TextInput, Modal, Button, TouchableOpacity, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

const MakeAppointmentModal = ({ visible, onClose, onConfirm, taskId }) => {
  const [appointmentDate, setAppointmentDate] = useState(new Date());
  const [appointmentTime, setAppointmentTime] = useState(new Date());
  const [location, setLocation] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleConfirm = () => {
    if (!location) {
      alert("Please enter the appointment location.");
      return;
    }
    onConfirm(taskId, appointmentDate.toISOString().split("T")[0], appointmentTime.toLocaleTimeString(), location);
    onClose();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View style={{ width: 300, backgroundColor: "white", padding: 20, borderRadius: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>Set Appointment</Text>

          {/* Date Picker */}
          <TouchableOpacity onPress={() => setShowDatePicker(true)}>
            <Text style={{ padding: 10, backgroundColor: "#eee", marginBottom: 10 }}>Select Date: {appointmentDate.toDateString()}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={appointmentDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setAppointmentDate(selectedDate);
              }}
            />
          )}

          {/* Time Picker */}
          <TouchableOpacity onPress={() => setShowTimePicker(true)}>
            <Text style={{ padding: 10, backgroundColor: "#eee", marginBottom: 10 }}>Select Time: {appointmentTime.toLocaleTimeString()}</Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={appointmentTime}
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedTime) => {
                setShowTimePicker(false);
                if (selectedTime) setAppointmentTime(selectedTime);
              }}
            />
          )}

          {/* Location Input */}
          <TextInput
            placeholder="Enter appointment location"
            value={location}
            onChangeText={setLocation}
            style={{ borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 5, marginBottom: 10 }}
          />

          {/* Buttons */}
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Button title="Cancel" onPress={onClose} color="red" />
            <Button title="Confirm" onPress={handleConfirm} color="green" />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default MakeAppointmentModal;
