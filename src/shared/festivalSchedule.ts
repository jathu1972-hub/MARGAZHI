export interface ConcertSessionSeed {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  performers: string[];
  displayOrder: number;
}

export interface FestivalDateSeed {
  id: string;
  dayNumber: number;
  eventDate: string; // YYYY-MM-DD
  dayName: string;
  dayAbbr: string;
  dateNumber: string;
  monthAbbr: string;
  monthFull: string;
  year: string;
  title: string;
  capacity: number;
  sessions: ConcertSessionSeed[];
}

export const FESTIVAL_INFO = {
  brand: 'MARGAZHI',
  edition: '28th Annual December Music Festival 2026',
  organizer: 'Sri Rama Bhaktha Jana Samaj',
  organizerAddress: 'K.K. Nagar, Chennai – 78',
  venue: 'Avichi College of Arts and Science',
  venueAddress: 'Arcot Road, Virugambakkam, Chennai – 92',
  duration: '26 December 2026 – 3 January 2027',
  capacityPerDate: 150,
  totalDates: 9,
} as const;

export const FESTIVAL_DATES_SEED: FestivalDateSeed[] = [
  {
    id: 'day-1-2026-12-26',
    dayNumber: 1,
    eventDate: '2026-12-26',
    dayName: 'Saturday',
    dayAbbr: 'SAT',
    dateNumber: '26',
    monthAbbr: 'DEC',
    monthFull: 'December',
    year: '2026',
    title: 'Inauguration, Sangeetha Maamani Award & Violin Concert — Sangita Kalanidhi Kumari A. Kanyakumari',
    capacity: 150,
    sessions: [
      {
        id: 'day-1-s1',
        startTime: '5:30 PM',
        endTime: '6:30 PM',
        title: 'Inauguration & Sangeetha Maamani Award Presentation',
        performers: [
          'Inauguration and presentation of the Sangeetha Maamani Award to Sangita Kalanidhi Kumari A. Kanyakumari',
        ],
        displayOrder: 1,
      },
      {
        id: 'day-1-s2',
        startTime: '6:30 PM',
        endTime: '9:00 PM',
        title: 'Violin Concert — Sangita Kalanidhi Kumari A. Kanyakumari',
        performers: [
          'Sangita Kalanidhi Kumari A. Kanyakumari — Violin',
          'M. Rajeev — Violin Support',
          'K. V. Prasad — Mridangam',
          'Vaikom R. Gopalakrishnan — Ghatam',
        ],
        displayOrder: 2,
      },
    ],
  },
  {
    id: 'day-2-2026-12-27',
    dayNumber: 2,
    eventDate: '2026-12-27',
    dayName: 'Sunday',
    dayAbbr: 'SUN',
    dateNumber: '27',
    monthAbbr: 'DEC',
    monthFull: 'December',
    year: '2026',
    title: 'Young Talent Concert & Veena Concert — Rajhesh Vaidhya & Party',
    capacity: 150,
    sessions: [
      {
        id: 'day-2-s1',
        startTime: '4:30 PM',
        endTime: '6:15 PM',
        title: 'Young Talent Concert',
        performers: [
          'Shreya Sundararaman — Vocal',
          'Prithvi Bhaskar — Violin',
          'Ajeet Sridhar — Mridangam',
        ],
        displayOrder: 1,
      },
      {
        id: 'day-2-s2',
        startTime: '6:30 PM',
        endTime: '9:00 PM',
        title: 'Veena Concert — Rajhesh Vaidhya & Party',
        performers: ['Rajhesh Vaidhya & Party — Veena'],
        displayOrder: 2,
      },
    ],
  },
  {
    id: 'day-3-2026-12-28',
    dayNumber: 3,
    eventDate: '2026-12-28',
    dayName: 'Monday',
    dayAbbr: 'MON',
    dateNumber: '28',
    monthAbbr: 'DEC',
    monthFull: 'December',
    year: '2026',
    title: 'Vocal Concert — K. S. Vishnudev',
    capacity: 150,
    sessions: [
      {
        id: 'day-3-s1',
        startTime: '6:30 PM',
        endTime: '9:00 PM',
        title: 'K. S. Vishnudev — Vocal',
        performers: [
          'K. S. Vishnudev — Vocal',
          'Alankode Gokul — Violin',
          'Praveen Sparsh — Mridangam',
          'Payyannur Govinda Prasad — Morsing',
        ],
        displayOrder: 1,
      },
    ],
  },
  {
    id: 'day-4-2026-12-29',
    dayNumber: 4,
    eventDate: '2026-12-29',
    dayName: 'Tuesday',
    dayAbbr: 'TUE',
    dateNumber: '29',
    monthAbbr: 'DEC',
    monthFull: 'December',
    year: '2026',
    title: 'Vocal Concert — Dr. N. J. Nandini',
    capacity: 150,
    sessions: [
      {
        id: 'day-4-s1',
        startTime: '6:30 PM',
        endTime: '9:00 PM',
        title: 'Dr. N. J. Nandini — Vocal',
        performers: [
          'Dr. N. J. Nandini — Vocal',
          'Alankode Gokul — Violin',
          'Aduthurai Guruprasad — Mridangam',
          'Udupi Srikanth — Khanjira',
        ],
        displayOrder: 1,
      },
    ],
  },
  {
    id: 'day-5-2026-12-30',
    dayNumber: 5,
    eventDate: '2026-12-30',
    dayName: 'Wednesday',
    dayAbbr: 'WED',
    dateNumber: '30',
    monthAbbr: 'DEC',
    monthFull: 'December',
    year: '2026',
    title: 'Flute Concert — Jayanth',
    capacity: 150,
    sessions: [
      {
        id: 'day-5-s1',
        startTime: '6:30 PM',
        endTime: '9:00 PM',
        title: 'Jayanth — Flute',
        performers: [
          'Jayanth — Flute',
          'Kamalakiran — Violin',
          'Srimushnam Rajarao — Mridangam',
          'S. V. Ramani — Gadam',
        ],
        displayOrder: 1,
      },
    ],
  },
  {
    id: 'day-6-2026-12-31',
    dayNumber: 6,
    eventDate: '2026-12-31',
    dayName: 'Thursday',
    dayAbbr: 'THU',
    dateNumber: '31',
    monthAbbr: 'DEC',
    monthFull: 'December',
    year: '2026',
    title: 'Vocal Concert — Cherthala Dr. K. N. Ranganatha Sharma',
    capacity: 150,
    sessions: [
      {
        id: 'day-6-s1',
        startTime: '6:30 PM',
        endTime: '9:00 PM',
        title: 'Cherthala Dr. K. N. Ranganatha Sharma — Vocal',
        performers: [
          'Cherthala Dr. K. N. Ranganatha Sharma — Vocal',
          'Vittal Ramamurthy — Violin',
          'Mannargudi A. Eswaran — Mridangam',
          'Vellattanjur Sreejith — Gadam',
        ],
        displayOrder: 1,
      },
    ],
  },
  {
    id: 'day-7-2027-01-01',
    dayNumber: 7,
    eventDate: '2027-01-01',
    dayName: 'Friday',
    dayAbbr: 'FRI',
    dateNumber: '1',
    monthAbbr: 'JAN',
    monthFull: 'January',
    year: '2027',
    title: 'Couple Vocal — Barghav S. Hariharan & Krupaalakshmi',
    capacity: 150,
    sessions: [
      {
        id: 'day-7-s1',
        startTime: '6:30 PM',
        endTime: '9:00 PM',
        title: 'Barghav S. Hariharan & Krupaalakshmi — Couple Vocal',
        performers: [
          'Barghav S. Hariharan & Krupaalakshmi — Couple Vocal',
          'M. Vijai — Violin',
          'K. V. Prasad — Mridangam',
          'Vazhappally Krishnakumar — Gadam',
        ],
        displayOrder: 1,
      },
    ],
  },
  {
    id: 'day-8-2027-01-02',
    dayNumber: 8,
    eventDate: '2027-01-02',
    dayName: 'Saturday',
    dayAbbr: 'SAT',
    dateNumber: '2',
    monthAbbr: 'JAN',
    monthFull: 'January',
    year: '2027',
    title: 'Vocal Concerts — R. P. Shravan & K. Gayatri',
    capacity: 150,
    sessions: [
      {
        id: 'day-8-s1',
        startTime: '4:30 PM',
        endTime: '6:15 PM',
        title: 'R. P. Shravan — Vocal',
        performers: [
          'R. P. Shravan — Vocal',
          'M. Vijai — Violin',
          'Puttur Nikshith — Mridangam',
        ],
        displayOrder: 1,
      },
      {
        id: 'day-8-s2',
        startTime: '6:30 PM',
        endTime: '9:00 PM',
        title: 'K. Gayatri — Vocal',
        performers: ['K. Gayatri — Vocal'],
        displayOrder: 2,
      },
    ],
  },
  {
    id: 'day-9-2027-01-03',
    dayNumber: 9,
    eventDate: '2027-01-03',
    dayName: 'Sunday',
    dayAbbr: 'SUN',
    dateNumber: '3',
    monthAbbr: 'JAN',
    monthFull: 'January',
    year: '2027',
    title: 'Vocal Concert & Namasankeerthanam — Finale',
    capacity: 150,
    sessions: [
      {
        id: 'day-9-s1',
        startTime: '4:30 PM',
        endTime: '6:15 PM',
        title: 'Kausthub P. Chandramouli & Party — Vocal',
        performers: ['Kausthub P. Chandramouli & Party — Vocal'],
        displayOrder: 1,
      },
      {
        id: 'day-9-s2',
        startTime: '6:30 PM',
        endTime: '9:00 PM',
        title: 'Namasankeerthanam by Melakode Ravi Bhagavathar & Party',
        performers: ['Melakode Ravi Bhagavathar & Party — Namasankeerthanam'],
        displayOrder: 2,
      },
    ],
  },
];
