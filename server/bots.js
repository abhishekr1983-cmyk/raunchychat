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

// ── Profile data pools (deterministic, varied) ─────────────────
const INTEREST_POOL = [
  'Music', 'Movies', 'Travel', 'Gaming', 'Fitness', 'Cooking', 'Reading',
  'Art', 'Photography', 'Dancing', 'Cricket', 'Football', 'Fashion',
  'Nature', 'Technology', 'Pets', 'Yoga', 'Coffee', 'Netflix', 'Nightlife',
  'Hiking', 'Singing', 'Bikes', 'Foodie', 'Anime',
];
const LANGUAGE_POOL = ['Hindi', 'English', 'Punjabi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Gujarati', 'Kannada', 'Malayalam'];
const LOOKING_POOL = ['Friendship', 'Casual chat', 'Dating', 'Flirting', 'Just here for fun'];
const REL_POOL = ['Single', 'Open relationship', "It's complicated", 'Prefer not to say'];
const ORI_MALE = ['Straight', 'Bisexual', 'Curious'];
const ORI_FEMALE = ['Straight', 'Bisexual', 'Curious', 'Pansexual'];
const BODY_MALE = ['Athletic', 'Average', 'Muscular', 'Slim'];
const BODY_FEMALE = ['Slim', 'Curvy', 'Average', 'Athletic'];
const BIO_TEMPLATES = [
  'Just here to meet new people and have fun conversations. 😊',
  'Love a good chat. Hit me up if you wanna talk!',
  'Foodie, traveller, and a hopeless romantic at heart.',
  'Looking for genuine connections, not just small talk.',
  'Easy going and always up for a laugh. Lets vibe.',
  'Coffee addict ☕ and weekend explorer. Say hi!',
  'Music is my therapy. Tell me your favourite song.',
  'Work hard, flirt harder. 😉',
  'New here — show me around and lets get to know each other.',
  'Honest, fun and a little bit naughty. 🔥',
];

// Simple deterministic picker: choose n items from pool based on a seed
function pick(pool, seed, n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    out.push(pool[(seed * 7 + k * 13 + 3) % pool.length]);
  }
  return [...new Set(out)];
}

function buildProfile(i, gender) {
  return {
    bio: BIO_TEMPLATES[i % BIO_TEMPLATES.length],
    interests: pick(INTEREST_POOL, i, 3 + (i % 3)),          // 3–5 interests
    lookingFor: pick(LOOKING_POOL, i + 2, 1 + (i % 2)),      // 1–2
    relationshipStatus: REL_POOL[i % REL_POOL.length],
    orientation: (gender === 'Female' ? ORI_FEMALE : ORI_MALE)[i % (gender === 'Female' ? ORI_FEMALE : ORI_MALE).length],
    languages: pick(LANGUAGE_POOL, i + 1, 2),
    bodyType: (gender === 'Female' ? BODY_FEMALE : BODY_MALE)[i % 4],
    height: `${gender === 'Female' ? 150 + (i % 25) : 165 + (i % 25)} cm`,
    avatarEmoji: '',
  };
}

function makeBots() {
  const bots = [];

  // ── 60 Male bots ────────────────────────────────────────────
  for (let i = 0; i < 60; i++) {
    bots.push({
      id: -(i + 1),                                     // -1 … -60
      username: MALE_NAMES[i],
      gender: 'Male',
      age: MALE_AGES[i],
      state: INDIAN_STATES[i % INDIAN_STATES.length],
      country: 'India',
      isGuest: true,
      isAdmin: false,
      ...buildProfile(i, 'Male'),
    });
  }

  // ── 40 Female bots ──────────────────────────────────────────
  for (let i = 0; i < 40; i++) {
    bots.push({
      id: -(61 + i),                                    // -61 … -100
      username: FEMALE_NAMES[i],
      gender: 'Female',
      age: FEMALE_AGES[i],
      state: INDIAN_STATES[(i + 11) % INDIAN_STATES.length],
      country: 'India',
      isGuest: true,
      isAdmin: false,
      ...buildProfile(i, 'Female'),
    });
  }

  return bots;
}

const BOTS = makeBots();
const BOTS_BY_ID = new Map(BOTS.map((b) => [b.id, b]));

module.exports = { BOTS, BOTS_BY_ID };
