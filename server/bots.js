/**
 * 100 persistent "always-online" bot users
 * 60 Male · 40 Female · All from India · Various states & ages
 * Bot IDs are negative integers so they never collide with real DB users.
 */

const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu',
  'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Chandigarh',
];

const MALE_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh',
  'Ayaan', 'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Pranav', 'Advait',
  'Dhruv', 'Kabir', 'Ritvik', 'Aarush', 'Veer', 'Arnav', 'Yuvraj',
  'Laksh', 'Parth', 'Rohan', 'Karan', 'Rahul', 'Nikhil', 'Ankit',
  'Vikram', 'Siddharth', 'Abhishek', 'Suresh', 'Amit', 'Ravi', 'Mohit',
  'Gaurav', 'Manish', 'Pankaj', 'Deepak', 'Rajesh', 'Sandeep', 'Pradeep',
  'Aakash', 'Harsh', 'Varun', 'Tushar', 'Sumit', 'Vishal', 'Tarun',
  'Naresh', 'Lokesh', 'Manoj', 'Dinesh', 'Hitesh', 'Girish', 'Ramesh',
  'Umesh', 'Yogesh', 'Sachin', 'Ajay',
];

const FEMALE_NAMES = [
  'Aarohi', 'Ananya', 'Diya', 'Ishita', 'Kavya', 'Myra', 'Navya',
  'Pari', 'Riya', 'Saanvi', 'Shreya', 'Siya', 'Tanvi', 'Tara',
  'Anika', 'Avni', 'Divya', 'Gauri', 'Ira', 'Jiya', 'Kiara',
  'Meera', 'Naina', 'Neha', 'Pooja', 'Priya', 'Radhika', 'Rhea',
  'Sakshi', 'Simran', 'Sneha', 'Sonam', 'Swati', 'Trisha', 'Usha',
  'Vandana', 'Vidya', 'Sunita', 'Rekha', 'Alka',
];

// Deterministic age spread — cycles through 18-45 in a pseudo-random pattern
const MALE_AGES   = [22, 25, 19, 31, 28, 23, 35, 20, 27, 33,
                     18, 29, 24, 38, 21, 26, 32, 18, 40, 23,
                     30, 19, 36, 25, 28, 22, 34, 27, 20, 43,
                     25, 31, 19, 26, 33, 21, 28, 24, 37, 22,
                     30, 18, 35, 29, 23, 41, 27, 24, 32, 19,
                     26, 38, 21, 28, 34, 23, 29, 20, 36, 25];

const FEMALE_AGES = [22, 19, 28, 24, 31, 20, 26, 33, 18, 29,
                     23, 35, 21, 27, 30, 18, 25, 32, 20, 38,
                     24, 29, 19, 34, 22, 28, 36, 21, 27, 40,
                     23, 18, 31, 26, 20, 33, 25, 29, 22, 35];

function makeBots() {
  const bots = [];

  // ── 60 Male bots ────────────────────────────────────────────
  for (let i = 0; i < 60; i++) {
    const baseName = MALE_NAMES[i];
    // Append a number suffix to guarantee uniqueness within the list
    const username = i < 30 ? baseName : `${baseName}${i - 29}`;
    bots.push({
      id: -(i + 1),                                     // -1 … -60
      username,
      gender: 'Male',
      age: MALE_AGES[i],
      state: INDIAN_STATES[i % INDIAN_STATES.length],
      country: 'India',
      isGuest: true,
      isAdmin: false,
      isBot: true,
    });
  }

  // ── 40 Female bots ──────────────────────────────────────────
  for (let i = 0; i < 40; i++) {
    const baseName = FEMALE_NAMES[i];
    const username = i < 20 ? baseName : `${baseName}${i - 19}`;
    bots.push({
      id: -(61 + i),                                    // -61 … -100
      username,
      gender: 'Female',
      age: FEMALE_AGES[i],
      state: INDIAN_STATES[(i + 11) % INDIAN_STATES.length],
      country: 'India',
      isGuest: true,
      isAdmin: false,
      isBot: true,
    });
  }

  return bots;
}

const BOTS = makeBots();

module.exports = { BOTS };
