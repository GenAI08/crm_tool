// src/pages/Reminders.tsx
import ReminderLog from "@/components/ReminderLog";

const Reminders = () => {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">📋 Reminders</h1>
      <ReminderLog />
    </div>
  );
};

export default Reminders;
