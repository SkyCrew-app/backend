# ✈️ SkyCrew - AeroClub Management System

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14-brightgreen)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/backend-NestJS-e0234e)](https://nestjs.com/)
[![React](https://img.shields.io/badge/frontend-React-61DAFB)](https://reactjs.org/)

---

## 📝 Description

**SkyCrew** is a comprehensive web-based application designed to streamline the management of an aeroclub. It offers real-time tracking of aircraft, reservation management, pilot certifications, maintenance tracking, and much more.

---

## 🌟 Features

- **🛩️ Real-time Fleet Tracking**: View aircraft availability, maintenance status, and flight history.
- **📅 Aircraft Reservations**: Automated booking system with conflict detection and notifications.
- **📖 Flight Logs & Maintenance Tracking**: Log flights and track maintenance history for each aircraft.
- **🎓 Pilot Qualifications**: Manage pilot licenses, certifications, and track flight hours.
- **👨‍🏫 Instructor Availability**: Plan instructor-led flights and manage availability.
- **💰 Cost Tracking**: Monitor operational expenses and aircraft utilization.
- **🔒 Security Audits**: Plan and log security inspections.
- **💳 Billing & Payments**: Automatically generate invoices for members and process online payments.

---

## 🛠️ Tech Stack

- **Backend**: [NestJS](https://nestjs.com/) 🐺, [GraphQL](https://graphql.org/) 🕸️, [TypeORM](https://typeorm.io/) 📚, [PostgreSQL](https://www.postgresql.org/) 🐘
- **Frontend**: [React.js](https://reactjs.org/) ⚛️
- **Database**: [PostgreSQL](https://www.postgresql.org/) 🐘
- **Messaging & Notifications**: [Mailgun](https://www.mailgun.com/) ✉️, SMS 📱
- **Background Processing**: [Bull](https://github.com/OptimalBits/bull) 🐂 (with [Redis](https://redis.io/) 🧰)

---

## 📸 Screenshots

![Dashboard Screenshot](https://via.placeholder.com/800x400.png?text=Dashboard+Screenshot)
*An overview of the main dashboard displaying key metrics and notifications.*

![Aircraft Tracking](https://via.placeholder.com/800x400.png?text=Aircraft+Tracking)
*Real-time fleet tracking with detailed aircraft information.*

---

## ⚙️ Installation

To set up the project locally, follow these steps:

### **Prerequisites**

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or above) 📦
- [PostgreSQL](https://www.postgresql.org/) 🐘
- [Redis](https://redis.io/) 🧰
- [Git](https://git-scm.com/) 🔧

### **Backend Setup**

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/aeroclub-management.git
   cd aeroclub-management
   ```

2. **Install backend dependencies:**

   ```bash
   cd backend
   npm install
   ```

3. **Set up environment variables:**

   Create a `.env` file in the backend root directory:

   ```env
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   DATABASE_USERNAME=your_postgres_user
   DATABASE_PASSWORD=your_postgres_password
   DATABASE_NAME=aeroclub_db
   JWT_SECRET=your_jwt_secret
   REDIS_HOST=localhost
   REDIS_PORT=6379
   MAILGUN_API_KEY=your_mailgun_api_key
   MAILGUN_DOMAIN=your_mailgun_domain
   ```

4. **Run database migrations:**

   ```bash
   npm run typeorm migration:run
   ```

5. **Start the NestJS backend server:**

   ```bash
   npm run start:dev
   ```

### **Frontend Setup**

1. **Navigate to the frontend directory:**

   ```bash
   cd ../frontend
   ```

2. **Install frontend dependencies:**

   ```bash
   npm install
   ```

3. **Start the React frontend development server:**

   ```bash
   npm start
   ```

### **Running Redis**

Ensure Redis is running. You can use Docker to run Redis:

```bash
docker run -d -p 6379:6379 redis
```

---

## 🎮 Usage

Once both the backend and frontend are running, navigate to `http://localhost:3000` in your browser to access the AeroClub Management System.

- **GraphQL Playground**: Access it at `http://localhost:3000/graphql` for testing API queries.
- **Default Credentials**: Use `admin@example.com` with password `admin123` for initial access (if set up).

---

## 📚 API Documentation

The backend exposes a **GraphQL API**. Explore the schema and run queries using the GraphQL Playground.

### **Example Queries**

#### 🧑‍✈️ Fetch All Users

```graphql
query {
  getUsers {
    id
    first_name
    last_name
    email
  }
}
```

#### ✈️ Create a New Reservation

```graphql
mutation {
  createReservation(
    createReservationInput: {
      aircraft_id: 1,
      user_id: 1,
      reservation_date: "2024-12-01",
      start_time: "2024-12-01T10:00:00Z",
      end_time: "2024-12-01T12:00:00Z"
    }
  ) {
    id
    aircraft {
      registration_number
    }
    user {
      first_name
      last_name
    }
    start_time
    end_time
  }
}
```

---

## 🧪 Testing

To run unit tests for the backend:

```bash
cd backend
npm run test
```

---

## 📅 Roadmap

- [ ] **Multi-language Support**: Implement localization for broader reach.
- [ ] **Mobile App Integration**: Develop companion apps for iOS and Android.
- [ ] **Advanced Analytics**: Add reporting tools for data-driven decisions.
- [ ] **Third-party Integrations**: Connect with maintenance and booking platforms.

---

## 🐛 Known Issues

- **Email Notifications**: Some users may experience delays due to SMTP configurations.
- **Timezone Discrepancies**: Reservation times may not adjust for different timezones.

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the Project**

2. **Create a Feature Branch**

   ```bash
   git checkout -b feature/YourFeature
   ```

3. **Commit Your Changes**

   ```bash
   git commit -m 'Add Your Feature'
   ```

4. **Push to the Branch**

   ```bash
   git push origin feature/YourFeature
   ```

5. **Open a Pull Request**

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgements

- **NestJS Community**: For their comprehensive documentation and support.
- **React Contributors**: For making frontend development intuitive.
- **Aviation Enthusiasts**: Inspiring the creation of this management system.

---

## 📬 Contact

For any inquiries or issues, feel free to reach out:

- **Name**: Your Name
- **Email**: [your.email@example.com](mailto:your.email@example.com)
- **LinkedIn**: [Your LinkedIn Profile](https://linkedin.com/in/yourprofile)
- **GitHub**: [YourUsername](https://github.com/yourusername)

---

*Made with ❤️ by MrBartou.*