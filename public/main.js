const socket = io('http://localhost:3000');

// Form submission logic with validation
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous error messages
    const errors = document.querySelectorAll('.error');
    errors.forEach(error => error.textContent = '');

    // Fetch input values
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const mobile = document.getElementById('mobile').value.trim();
    const email = document.getElementById('email').value.trim();
    const address = document.getElementById('address').value.trim();
    const city = document.getElementById('city').value.trim();
    const state = document.getElementById('state').value.trim();
    const country = document.getElementById('country').value.trim();
    const loginID = document.getElementById('loginID').value.trim();
    const password = document.getElementById('password').value.trim();

    let hasError = false;

    // Validate First Name
    if (!/^[A-Za-z]+$/.test(firstName)) {
        document.getElementById('firstNameError').textContent = 'First name must contain only letters.';
        hasError = true;
    }

    // Validate Last Name
    if (!/^[A-Za-z]+$/.test(lastName)) {
        document.getElementById('lastNameError').textContent = 'Last name must contain only letters.';
        hasError = true;
    }

    // Validate Mobile Number (assumes a 10-digit format)
    if (!/^\d{10}$/.test(mobile)) {
        document.getElementById('mobileError').textContent = 'Mobile number must be 10 digits.';
        hasError = true;
    }

    // Validate Email
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        document.getElementById('emailError').textContent = 'Invalid email address.';
        hasError = true;
    }

    // Validate other fields...
    if (loginID.length !== 8) {
        document.getElementById('loginIDError').textContent = 'Login ID must be exactly 8 characters.';
        hasError = true;
    }

    if (password.length < 8) {
        document.getElementById('passwordError').textContent = 'Password must be at least 8 characters.';
        hasError = true;
    }

    // Proceed if no errors
    if (!hasError) {
        const userData = {
            firstName, lastName, mobile, email, address, city, state, country, loginID, password
        };

        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
            });

            const data = await response.json();
            if (response.ok) {
                document.getElementById('successMessage').textContent = 'User registered successfully!';
                socket.emit('userOnline', email);
            } else {
                document.getElementById('successMessage').textContent = 'Error: ' + data.error;
            }
        } catch (error) {
            document.getElementById('successMessage').textContent = 'Server error.';
        }
    }
});

// Display live users and add click listener to fetch details
socket.on('liveUsers', (users) => {
    const liveUsersTable = document.getElementById('liveUsers');
    liveUsersTable.innerHTML = '';  // Clear previous users

    users.forEach(user => {
        const row = `<tr>
                        <td><a href="#" class="user-link" data-email="${user.email}">${user.email}</a></td>
                        <td>${user.socketID}</td>
                        <td>${user.status}</td>
                    </tr>`;
        liveUsersTable.innerHTML += row;
    });

    // Add event listeners to the email links to fetch user details
    const userLinks = document.querySelectorAll('.user-link');
    userLinks.forEach(link => {
        link.addEventListener('click', async (event) => {
            event.preventDefault();
            const email = event.target.getAttribute('data-email');
            fetchUserDetails(email);
        });
    });
});

// Function to open modal and display user details
function openModal(user) {
    const modal = document.getElementById('userDetailsModal');
    const userDetailsDiv = document.getElementById('userDetails');
    
    // Populate the user details in the modal
    userDetailsDiv.innerHTML = `
        <h2>User Details</h2>
        <p><strong>First Name:</strong> ${user.firstName}</p>
        <p><strong>Last Name:</strong> ${user.lastName}</p>
        <p><strong>Mobile:</strong> ${user.mobile}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Address:</strong> ${user.address}</p>
        <p><strong>City:</strong> ${user.city}</p>
        <p><strong>State:</strong> ${user.state}</p>
        <p><strong>Country:</strong> ${user.country}</p>
        <p><strong>Login ID:</strong> ${user.loginID}</p>
    `;
    
    // Show the modal
    modal.style.display = "flex";
}

// Fetch and display user details in modal
async function fetchUserDetails(email) {
    try {
        const response = await fetch(`/user/${email}`);
        const user = await response.json();

        if (response.ok) {
            openModal(user);
        } else {
            alert('User not found');
        }
    } catch (error) {
        console.error('Error fetching user details:', error);
    }
}

// Add event listeners to the email links to fetch user details
const userLinks = document.querySelectorAll('.user-link');
userLinks.forEach(link => {
    link.addEventListener('click', async (event) => {
        event.preventDefault();
        const email = event.target.getAttribute('data-email');
        fetchUserDetails(email);
    });
});

// Close the modal when the user clicks the close button
const closeModalButton = document.querySelector('.close');
closeModalButton.addEventListener('click', () => {
    document.getElementById('userDetailsModal').style.display = "none";
});

// Close the modal when the user clicks outside of the modal
window.addEventListener('click', (event) => {
    const modal = document.getElementById('userDetailsModal');
    if (event.target === modal) {
        modal.style.display = "none";
    }
});
