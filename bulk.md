Objective: Implement a "Data Management" bulk import system for the Admin Panel.

Please read all requirements carefully. Before writing any code, you MUST review the Django backend `models.py` files across all apps (Master Data, Operations, Records) to understand the current table structure and foreign key relationships.

Requirements:
1. Routing & Navbar:
   - Create a new group in the admin `Navbar.jsx` called "System".
   - Inside "System", add a link for "Data Management" which routes to a new page (e.g., `/admin/system/data-management`).

2. Data Management Page (Frontend):
   - Build a clean, modern interface where the administrator can select a target table/entity to import data into (e.g., Airports, Airlines, Flight Routes, Seat Maps, etc.).
   - CRITICAL: Do NOT include any options to import user details, accounts, or passenger profiles. This is strictly for operational and master data.
   - Include a file upload zone that strictly accepts `.csv`, `.xls`, and `.xlsx` file formats.

3. Import Processing & Reporting:
   - When the file is submitted, send it to a new backend Django API endpoint capable of parsing pandas/openpyxl or standard CSV formats.
   - The backend should handle bulk creation, ensuring existing foreign key relationships are respected and validation is enforced.
   - Upon completion (success or partial failure), the frontend must trigger an "Import Report" popup/modal. This report should display:
     - Total rows processed.
     - Number of successful insertions.
     - Number of failed rows, along with specific validation error messages for the failed rows so the admin knows what to fix.

Please start by investigating the database models to understand the schema, then provide a step-by-step implementation plan for both the Django backend and the React frontend.
