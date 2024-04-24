const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const config = require('./config');

const app = express();
const port = 3001;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// MySQL connection
const db = mysql.createConnection(config.mysql);
db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database');
  
  // Execute the create user table query after successful database connection
  createUserTable();
  createVenuesTable();
});

// Define a function to create the user table
function createUserTable() {
  const createUserTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      otp VARCHAR(6) NOT NULL,
      otp_verified BOOLEAN DEFAULT false
    )
  `;

  // Execute the create user table query
  db.query(createUserTableQuery, (err) => {
    if (err) {
      console.error('Error creating user table:', err);
      throw err;
    }
    console.log('User table created successfully');
  });
}

function createVenuesTable() {
  const createVenuesTableQuery = `
    CREATE TABLE IF NOT EXISTS venues (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      city VARCHAR(255) NOT NULL,
      contact VARCHAR(255) NOT NULL,
      owner_name VARCHAR(255) NOT NULL
    )
  `;

  // Execute the create venues table query
  db.query(createVenuesTableQuery, (err) => {
    if (err) {
      console.error('Error creating venues table:', err);
      throw err;
    }
    console.log('Venues table created successfully');
  });
}

// Nodemailer configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'jujarvipul21@gmail.com',
    pass: 'dgor zqet tnad akrg'
  }
});

// Generate OTP function
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store OTP in session when sending it to the user
const sessions = {};

// Endpoint for sending OTP
app.post('/sendotp', async (req, res) => {
  const { email } = req.body;

  // Generate OTP
  const otp = generateOTP();

  // Store OTP in session
  sessions[email] = otp;

  // Send OTP to user's email
  const mailOptions = {
    from: 'jujarvipul21@gmail.com',
    to: email,
    subject: 'Email Verification OTP',
    text: `Your OTP for email verification is: ${otp}`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent');
    return res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Endpoint for OTP verification
app.post('/verify', (req, res) => {
  const { email, otp } = req.body;

  // Retrieve OTP from session
  const storedOTP = sessions[email];

  if (!storedOTP) {
    return res.status(400).json({ message: 'OTP not found in session' });
  }

  // Check if OTP matches
  if (storedOTP !== otp) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  // Remove OTP from session after successful verification
  delete sessions[email];

  console.log('Email OTP verified successfully');
  return res.status(200).json({ message: 'Email OTP verified successfully' });
});

// Endpoint for user registration with email OTP verification
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user with OTP into the database
    const insertUserQuery = 'INSERT INTO users (username, password) VALUES (?, ?)';
    await db.query(insertUserQuery, [username, hashedPassword]);

    console.log('User registered successfully');
    return res.status(200).json({ message: 'User registered successfully. Please verify your email.' });
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Endpoint for user login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if the username exists in the database
    const getUserQuery = 'SELECT * FROM users WHERE username = ?';
    db.query(getUserQuery, [username], async (err, result) => {
      if (err) {
        console.error('Error fetching user:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      if (result.length === 0) {
        // User not found
        return res.status(404).json({ message: 'User not found' });
      }

      const user = result[0];

      // Check if the provided password matches the hashed password in the database
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        // Incorrect password
        return res.status(401).json({ message: 'Incorrect password' });
      }

      // Login successful
      return res.status(200).json({ message: 'Login successful' });
    });
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


// Endpoint for submitting venue booking form
app.post('/submit', (req, res) => {
  const { city, venue, date, email, otp, amountPaid, transactionNumber } = req.body;

  try {
    // SQL query to insert data into the table including the new fields
    const insertDataQuery = `
    INSERT INTO venue_bookings (city, venue, date, email, otp, amount_paid, transaction_number) 
VALUES (?, ?, ?, ?, ?, ?, ?)

    `;

    // Execute insert data query
    db.query(
      insertDataQuery,
      [city, venue, date, email, otp, amountPaid, transactionNumber],
      (err, result) => {
        if (err) {
          console.error('Error inserting data:', err);
          return res.status(500).json({ message: 'Internal server error' });
        }

        console.log('Form data submitted successfully');
        return res.status(200).json({ message: 'Form data submitted successfully' });
      }
    );
  } catch (error) {
    console.error('Error submitting form data:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


app.get('/bookings', (req, res) => {
  try {
    // SQL query to retrieve venue bookings
    const getBookingsQuery = `
    SELECT city, venue, date, email, otp, amount_paid AS amountPaid, transaction_number AS transactionNumber
    FROM venue_bookings
    `;
    
    // Execute the query
    db.query(getBookingsQuery, (err, result) => {
      if (err) {
        console.error('Error fetching bookings:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      // Send the bookings data as JSON response
      return res.status(200).json(result);
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Update a booking
app.put('/bookings/:id', (req, res) => {
  const { id } = req.params;
  const { city, venue, date } = req.body;

  try {
    // SQL query to update the booking
    const updateBookingQuery = `
      UPDATE venue_bookings
      SET city = ?, venue = ?, date = ?
      WHERE id = ?
    `;
    
    // Execute the update query
    db.query(updateBookingQuery, [city, venue, date, id], (err, result) => {
      if (err) {
        console.error('Error updating booking:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      return res.status(200).json({ message: 'Booking updated successfully' });
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a booking
app.delete('/bookings/:id', (req, res) => {
  const { id } = req.params;

  try {
    // SQL query to delete the booking
    const deleteBookingQuery = `
      DELETE FROM venue_bookings
      WHERE id = ?
    `;

    // Execute the delete query
    db.query(deleteBookingQuery, [id], (err, result) => {
      if (err) {
        console.error('Error deleting booking:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }

      return res.status(200).json({ message: 'Booking deleted successfully' });
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

//ADMIN
// Endpoint to fetch all users
app.get('/users', (req, res) => {
  const getUsersQuery = 'SELECT id, username, password FROM users';
  db.query(getUsersQuery, (err, result) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json(result);
  });
});

// Endpoint to delete a user
app.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  const deleteUserQuery = 'DELETE FROM users WHERE id = ?';
  db.query(deleteUserQuery, [id], (err, result) => {
    if (err) {
      console.error('Error deleting user:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    console.log('User deleted successfully');
    return res.status(200).json({ message: 'User deleted successfully' });
  });
});

// Endpoint to update a user
app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password } = req.body;
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user information in the database
    const updateUserQuery = 'UPDATE users SET username = ?, password = ? WHERE id = ?';
    db.query(updateUserQuery, [username, hashedPassword, id], (err, result) => {
      if (err) {
        console.error('Error updating user:', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
      console.log('User updated successfully');
      return res.status(200).json({ message: 'User updated successfully' });
    });
  } catch (error) {
    console.error('Error hashing password:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Endpoint for adding a new venue
app.post('/venues', async (req, res) => {
  const { name, city, contact, ownerName } = req.body;

  try {
    // Insert new venue into the database
    const insertVenueQuery = 'INSERT INTO venues (name, city, contact, owner_name) VALUES (?, ?, ?, ?)';
    await db.query(insertVenueQuery, [name, city, contact, ownerName]);

    console.log('Venue added successfully');
    return res.status(200).json({ message: 'Venue added successfully' });
  } catch (error) {
    console.error('Error adding venue:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Endpoint for fetching all venues
app.get('/venues', (req, res) => {
  const { city } = req.query;
  let getVenuesQuery = 'SELECT * FROM venues';

  if (city) {
    getVenuesQuery += ' WHERE city = ?';
  }

  db.query(getVenuesQuery, [city], (err, result) => {
    if (err) {
      console.error('Error fetching venues:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json(result);
  });
});

// Add a new endpoint to fetch the list of cities
app.get('/cities', (req, res) => {
  const getCitiesQuery = 'SELECT DISTINCT city FROM venues';

  db.query(getCitiesQuery, (err, result) => {
    if (err) {
      console.error('Error fetching cities:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    const cities = result.map((row) => row.city);
    return res.status(200).json(cities);
  });
});

app.get('/venue/:id', (req, res) => {
  const venueId = req.params.id;
  const getVenueQuery = 'SELECT city FROM venues WHERE id = ?';

  db.query(getVenueQuery, [venueId], (err, result) => {
    if (err) {
      console.error('Error fetching venue:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (result.length === 0) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    return res.status(200).json({ city: result[0].city });
  });
});

app.put('/venues/:id', (req, res) => {
  const venueId = req.params.id;
  const { name, city, contact, ownerName } = req.body;

  const updateVenueQuery = 'UPDATE venues SET name = ?, city = ?, contact = ?, owner_name = ? WHERE id = ?';

  db.query(updateVenueQuery, [name, city, contact, ownerName, venueId], (err, result) => {
    if (err) {
      console.error('Error updating venue:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json({ message: 'Venue updated successfully' });
  });
});

// Route to delete a venue
app.delete('/venues/:id', (req, res) => {
  const venueId = req.params.id;

  const deleteVenueQuery = 'DELETE FROM venues WHERE id = ?';

  db.query(deleteVenueQuery, [venueId], (err, result) => {
    if (err) {
      console.error('Error deleting venue:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json({ message: 'Venue deleted successfully' });
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
