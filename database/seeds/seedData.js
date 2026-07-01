// =============================================
// database/seeds/seedData.js
// Pre-populate MongoDB with sample FAQs
// =============================================

const mongoose = require('mongoose');
let FAQ;
try { FAQ = require('../../backend/models/FAQ'); } catch(e) {
  try { FAQ = require('../models/FAQ'); } catch(e2) {
    try { FAQ = require('../../models/FAQ'); } catch(e3) { return; }
  }
}

const SAMPLE_FAQS = [
  {
    keywords: ['fee', 'fees', 'payment', 'deadline', 'due date', 'last date', 'pay'],
    intent: 'fee_deadline',
    category: 'fees',
    answers: {
      en: '📅 **Fee Payment Deadlines:**\n• Semester 1: July 31\n• Semester 2: January 31\n• Late fee: ₹500 after deadline\n• Portal: fees.college.edu',
      hi: '📅 **शुल्क भुगतान की अंतिम तिथि:**\n• सेमेस्टर 1: 31 जुलाई\n• सेमेस्टर 2: 31 जनवरी\n• विलंब शुल्क: ₹500',
    }
  },
  {
    keywords: ['scholarship', 'merit', 'financial aid', 'stipend'],
    intent: 'scholarship',
    category: 'scholarships',
    answers: {
      en: '🏆 **Scholarships Available:**\n• Merit (75%+): ₹15,000/year\n• SC/ST/OBC: Apply at NSP portal\n• Need-based: Family income < ₹3 LPA\n\nDeadline: September 30',
    }
  },
  {
    keywords: ['admission', 'apply', 'application', 'enroll', 'joining'],
    intent: 'admission',
    category: 'admissions',
    answers: {
      en: '🎓 **Admission Steps:**\n1. Fill form: admissions.college.edu\n2. Upload marksheets + ID proof\n3. Pay ₹500 application fee\n4. Entrance test / Merit list\n5. Document verification\n\nForms open May 1 – June 30',
    }
  },
  {
    keywords: ['exam', 'examination', 'schedule', 'test', 'paper'],
    intent: 'exam_schedule',
    category: 'exams',
    answers: {
      en: '📅 **Exam Schedule:**\n• Mid-Semester: Sept 15–25\n• End-Semester: Nov 20 – Dec 10\n• Admit cards: 7 days before\n• Portal: exams.college.edu',
    }
  },
  {
    keywords: ['hostel', 'dormitory', 'accommodation', 'room', 'mess', 'warden'],
    intent: 'hostel',
    category: 'hostel',
    answers: {
      en: '🏠 **Hostel Info:**\n• Boys: Block A & B | Girls: Block C\n• Mess: 7-9am, 12-2pm, 7-9pm\n• Monthly: ₹4,500 + ₹3,200 mess\n• Curfew: 10:00 PM',
    }
  },
  {
    keywords: ['library', 'book', 'books', 'reading', 'borrow', 'return'],
    intent: 'library',
    category: 'library',
    answers: {
      en: '📚 **Library Timings:**\n• Mon–Sat: 8 AM – 9 PM\n• Sunday: 10 AM – 5 PM\n• 3 books / 14 days\n• Fine: ₹2/day\n• E-Library: elibrary.college.edu',
    }
  },
  {
    keywords: ['placement', 'job', 'career', 'internship', 'campus drive', 'recruit'],
    intent: 'placement',
    category: 'placements',
    answers: {
      en: '💼 **Placements 2024:**\n• Avg: ₹6.5 LPA | Highest: ₹28 LPA\n• Placement rate: 87%\n• Drives: October – March\n• Register: placement.college.edu',
    }
  },
  {
    keywords: ['timetable', 'time table', 'class schedule', 'lecture', 'period'],
    intent: 'timetable',
    category: 'timetable',
    answers: {
      en: '🗓 **Class Timetable:**\n• Hours: 8:00 AM – 5:00 PM\n• Each period: 55 minutes\n• Lunch: 12:30 – 1:15 PM\n• Portal: timetable.college.edu',
    }
  },
];

async function seedDatabase() {
  try {
    if (!FAQ) return;

    // Only seed if collection is empty
    const count = await FAQ.countDocuments();
    if (count === 0) {
      await FAQ.insertMany(SAMPLE_FAQS);
      console.log(`✅ Seeded ${SAMPLE_FAQS.length} FAQs into MongoDB`);
    } else {
      console.log(`ℹ️  Database already has ${count} FAQs, skipping seed`);
    }
  } catch (err) {
    console.log('⚠️  Could not seed database:', err.message);
  }
}

seedDatabase();
module.exports = { seedDatabase, SAMPLE_FAQS };
