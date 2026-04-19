# **App Name**: FahrWerk

## Core Features:

- PIN-Gate Authentication: Simple PIN-based authentication to restrict app access based on user role and PIN verification against Firestore. Stores session data in localStorage.
- Vehicle Management: Create, read, update, and delete vehicle records with comprehensive details including VIN, license plate, make, model, mileage, status, and associated documents/events stored in Firestore.
- Driver Management: Manage driver information including personal details, contact information, license details, and assigned vehicles, with data stored in Firestore.
- Task Management: Create, assign, and track tasks related to vehicles or drivers, with status updates and due dates. Includes a task Kanban board and real-time updates using onSnapshot from Firestore.
- Reminder System: Set and manage reminders for vehicle services, inspections, and other events, with color-coded display based on the due date proximity, updating `days_left`.
- Dashboard Aggregation: Presents aggregated data like counts and lists derived from vehicle collections for vehicles, drivers and tasks, for overview monitoring.
- Cloud Function Automation: Automated processes including daily reminder calculations, aggregation of vehicle data, updating vehicles costs based on events, and the maintaining of an audit log to show data modification over time using Firebase Cloud Functions.

## Style Guidelines:

- Primary color: Vibrant blue (#29ABE2) to convey reliability and modernity, reflecting the efficiency of fleet management. 
- Background color: Light gray (#F5F5F5), nearly desaturated from the primary color.
- Accent color: Yellow-green (#90EE90), approximately 30 degrees to the 'left' of the primary on the color wheel, indicating due dates on the calendar.
- Body and headline font: 'Inter', a grotesque-style sans-serif for a clean and modern user experience.
- Use clear and functional icons from a library like FontAwesome to represent vehicle types, maintenance tasks, and driver-related actions.
- Implement a responsive, desktop-first layout using Tailwind CSS grid and flexbox to ensure optimal usability across different screen sizes.
- Use subtle transitions and animations to enhance user interaction, such as fading in new data, smoothly transitioning between views, and highlighting important alerts.