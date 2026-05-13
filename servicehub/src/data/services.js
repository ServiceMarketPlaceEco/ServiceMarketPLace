// shared service data: used by service cards, task flow, and request form summaries.
export const services = [
  {
    id: 'bazaar',
    title: 'Daily Bazaar Shopping',
    category: 'household errands',
    description: 'Groceries, fresh produce, family shopping and local market runs.',
    price: 150,
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
    tasks: ['Fresh grocery shopping', 'Weekly family bazaar', 'Specific item pickup', 'Market price checking', 'Bulk household items']
  },
  {
    id: 'medicine',
    title: 'Medicine Pickup',
    category: 'health support',
    description: 'Collect medicine from pharmacies around Rajshahi with clear prescription details.',
    price: 180,
    image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80',
    tasks: ['Prescription medicine pickup', 'Pharmacy order collection', 'Emergency medicine delivery', 'Monthly medicine refill', 'Custom medicine request']
  },
  {
    id: 'delivery',
    title: 'Food & Parcel Delivery',
    category: 'delivery',
    description: 'Send food, documents or small parcels across local Rajshahi areas.',
    price: 120,
    image: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=1200&q=80',
    tasks: ['Food pickup and drop off', 'Document delivery', 'Small parcel delivery', 'Shop-to-home delivery', 'Same-day local delivery']
  },
  {
    id: 'cleaning',
    title: 'Home Cleaning',
    category: 'home support',
    description: 'Book local cleaners for regular rooms, kitchens, bathrooms and move-out cleaning.',
    price: 500,
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80',
    tasks: ['One room cleaning', 'Kitchen cleaning', 'Bathroom cleaning', 'Deep home cleaning', 'Move-out cleaning']
  },
  {
    id: 'tutoring',
    title: 'Tutoring Support',
    category: 'education',
    description: 'Find local tutors for school support, exam practice and basic computer lessons.',
    price: 350,
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80',
    tasks: ['School homework support', 'English lesson', 'Math practice', 'Exam preparation', 'Computer basics']
  },
  {
    id: 'repair',
    title: 'Appliance Repair',
    category: 'technical repair',
    description: 'Request help for fans, refrigerators, washing machines and small household devices.',
    price: 450,
    image: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=1200&q=80',
    tasks: ['Fan repair', 'Refrigerator check', 'Washing machine repair', 'Small device diagnosis', 'Emergency appliance help']
  }
]
