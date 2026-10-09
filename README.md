# ✈️ SkyCrew - AeroClub Management System

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
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
- **Frontend**: [React.js](https://reactjs.org/) ⚛️ [ShadCN](https://ui.shadcn.com/) for UI components, [Next.js](https://nextjs.org/) for server-side rendering
- **Database**: [PostgreSQL](https://www.postgresql.org/) 🐘 [Redis](https://redis.io/) 🧰
- **Messaging & Notifications**: [Mailgun](https://www.mailgun.com/) ✉️, SMS 📱
- **Payment Processing**: [Stripe](https://stripe.com/) 💳, [Paypal](https://www.paypal.com/) 💳
- **Background Processing**: [Jenkins](https://www.jenkins.io/) for CI/CD

---

## 📸 Screenshots

![Dashboard Screenshot](/screen//homepage.png)
*An overview of the main dashboard displaying key metrics and notifications.*

![Aircraft Tracking](/screen/flotte.png)
*Real-time fleet tracking with detailed aircraft information.*

![E-Learning](/screen/elearning.png)
*E-learning module for pilot training and certification management.*

---

## ⚙️ Installation

To set up the project locally, follow these steps:

### **Prerequisites**

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v20 or above) 📦
- [npm](https://www.npmjs.com/) (Node Package Manager) 📦
- [Docker](https://www.docker.com/) (for containerized setup) 🐳 or [Kubernetes](https://kubernetes.io/) (for orchestration) ☸️
- [Git](https://git-scm.com/) 🔧

### **Backend Setup**

1. **Clone the repository:**

   ```bash
   git clone https://github.com/SkyCrew-app/backend
   ```

2. **Install backend dependencies:**

   ```bash
   cd backend
   npm install
   ```

3. **Set up environment variables:**

   Create a `.env` file in the backend root directory:
   Please refer to the `.env.example` file for required variables.

   For evaluation purposes, you can use the .env file provided in the repository.


4. **Start the setup (Server, Database, Redis, mailhog):**

   ```bash
   docker-compose up -d
   ```

5. **For evaluation purposes:**

   Copy the exemple database file for evaluation purposes:

   ```bash
   cp bdd/example.sql
   ```

   Connect to PostgreSQL docker container and execute the SQL file:

   ```bash
      docker exec -i <container_name> psql -U <username> -d <database_name> -f /path/to/example.sql
   ```

7. **Use SkyCrew**

   Connect to your browser at `http://localhost:3000` to access the backend API.
   You can also access the GraphQL playground at `http://localhost:3000/graphql`.

---

### **Monitoring Setup**

1. **Go to the monitoring directory:**

   ```bash
   cd backend/monitoring
   ```

2. **Start the monitoring services:**

   ```bash
   docker-compose up -d
   ```

3. **Access the monitoring dashboard:**
   Open your browser and navigate to `http://localhost:9090/` to view the Prometheus dashboard.
   Open `http://localhost:8000/` to view the Grafana dashboard.

---


## 🎮 Usage

Once both the backend and frontend are running, navigate to `http://localhost:3000` in your browser to access SkyCrew.

- **GraphQL Playground**: Access it at `http://localhost:3000/graphql` for testing API queries.
- **First administrator**: `npm run seed` creates the account set by `ADMIN_EMAIL` (default `admin@example.com`) with the password in `ADMIN_PASSWORD`. `ADMIN_PASSWORD` is required the first time; the seed stops with an error if it is missing.

---

## 📚 API Documentation

The backend exposes a **GraphQL API**. Explore the schema and run queries using the GraphQL Playground.
You can find the API documentation at `http://localhost:3000/playground`.

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

To run coverage reports:

```bash
npm run test:cov
```

---

## 📅 Roadmap

- [ ] **Multi-language Support**: Implement localization for broader reach.
- [ ] **Mobile App Integration**: Develop companion apps for iOS and Android.
- [ ] **Advanced Analytics**: Add reporting tools for data-driven decisions.
- [ ] **Third-party Integrations**: Connect with maintenance and booking platforms.

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the Project**

2. **Create a Feature Branch**

   ```bash
   git checkout -b feature/YourFeature or git checkout -b fix/YourBugFix
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

- **Name**: Anthony DENIN
- **Email**: [anthony.denin@ynov.com](mailto:anthony.denin@ynov.com)
- **LinkedIn**: [Anthony DENIN](https://linkedin.com/in/anthony-denin)
- **GitHub**: [MrBartou](https://github.com/MrBartou)

---

*Made with ❤️ by MrBartou.*
