# How to Create the First Admin User

Since the Admin Dashboard handles creating *other* users, you need to manually Create the **First Admin** directly in the Firebase Console.

## Step 1: Create the Auth User
1. Go to your **Firebase Console** -> **Authentication** -> **Users**.
2. Click **"Add user"**.
3. Enter an email (e.g., `admin@school.com`) and password.
4. Click **"Add user"**.
5. **Copy the UID** of the newly created user (hover over the user row to see the Copy UID icon).

## Step 2: Create the User Profile in Firestore
1. Go to **Firebase Console** -> **Firestore Database**.
2. Go to the `users` collection.
3. Click **"Add document"**.
4. **Important**: For "Document ID", paste the **UID** you copied in Step 1.
5. Add the following fields:
   - **role** (string): `admin`  <-- *This is the critical field*
   - **email** (string): `admin@school.com`
   - **name** (string): `Super Admin`

## Step 3: Login
Now you can go to your app (`/`) and log in with these credentials. You will be redirected to the Admin Dashboard (once implemented).

---

## Schema Reference

**Admin User:**
```json
{
  "email": "admin@example.com",
  "role": "admin",
  "name": "Admin Name"
}
```

**Teacher User:**
```json
{
  "email": "teacher@example.com",
  "role": "teacher",
  "name": "Teacher Name"
}
```

**Student User:**
```json
{
  "email": "student@example.com",
  "role": "student",
  "name": "Student Name",
  "rollNumber": "101",
  "class": "10A"
}
```
