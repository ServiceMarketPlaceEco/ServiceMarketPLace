export const formatBDT = value =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0
  }).format(Number(value || 0))

// Turns slugs like "assigned-to-provider" or "in_progress" into "Assigned to provider"
export const formatStatus = value => {
  const text = String(value || '').replace(/[-_]+/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''
}

export const services = [
  {
    id: 'cleaning',
    title: 'Home Cleaning',
    category: 'Home',
    price: 500,
    currency: 'BDT',
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952',
    description: 'General cleaning, kitchen cleaning and household support in Rajshahi.'
  },
  {
    id: 'moving',
    title: 'Moving Help',
    category: 'Transport',
    price: 1200,
    currency: 'BDT',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c',
    description: 'Packing, lifting, small shifting and local moving support.',
    upfrontPayment: {
      required: true,
      amount: 300,
      bankName: 'BRAC Bank',
      accountName: 'ServiceHub Moving Provider',
      accountNumber: '01700000001',
      note: 'Moving jobs require a small provider deposit before vehicle scheduling.'
    }
  },
  {
    id: 'delivery',
    title: 'Local Delivery',
    category: 'Errands',
    price: 250,
    currency: 'BDT',
    image: 'https://images.unsplash.com/photo-1604357209793-fca5dca89f97',
    description: 'Parcel, medicine, document and food delivery around Rajshahi.'
  },
  {
    id: 'tech',
    title: 'Tech Support',
    category: 'Technology',
    price: 800,
    currency: 'BDT',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3',
    description: 'Laptop, WiFi, mobile setup and basic software support.'
  },
  {
    id: 'ac-repair',
    title: 'AC Repair',
    category: 'Home repair',
    price: 1000,
    currency: 'BDT',
    image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4',
    description: 'AC servicing, cooling issue checks and installation help.',
    upfrontPayment: {
      required: true,
      amount: 250,
      bankName: 'Dutch-Bangla Bank',
      accountName: 'Rajshahi AC Provider',
      accountNumber: '01800000002',
      note: 'AC repair requires an inspection booking deposit before provider dispatch.'
    }
  },
  {
    id: 'electrician',
    title: 'Electrician',
    category: 'Home repair',
    price: 600,
    currency: 'BDT',
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e',
    description: 'Fan, switch, light, socket and wiring support.',
    upfrontPayment: {
      required: true,
      amount: 200,
      bankName: 'City Bank',
      accountName: 'Rajshahi Electrical Provider',
      accountNumber: '01900000003',
      note: 'Electrical work may require upfront inspection payment for safety scheduling.'
    }
  },
  {
    id: 'plumbing',
    title: 'Plumbing Help',
    category: 'Home repair',
    price: 550,
    currency: 'BDT',
    image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39',
    description: 'Tap leaks, pipe issues, bathroom fittings and drainage help.'
  },
  {
    id: 'tutoring',
    title: 'Home Tutoring',
    category: 'Education',
    price: 700,
    currency: 'BDT',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7',
    description: 'Local academic support for school and college students.'
  },
  {
    id: 'elder-care',
    title: 'Elder Care Visit',
    category: 'Care',
    price: 900,
    currency: 'BDT',
    image: 'https://images.unsplash.com/photo-1584515933487-779824d29309',
    description: 'Basic home visit support, errands and check-in assistance.'
  }
]

export const locations = [
  { id: 'boalia', name: 'Boalia', area: 'Central Rajshahi' },
  { id: 'motihar', name: 'Motihar', area: 'University area' },
  { id: 'rajpara', name: 'Rajpara', area: 'Residential area' },
  { id: 'shah-makhdum', name: 'Shah Makhdum', area: 'Airport side' },
  { id: 'laxmipur', name: 'Laxmipur', area: 'Hospital and shopping area' },
  { id: 'shaheb-bazar', name: 'Shaheb Bazar', area: 'Market area' },
  { id: 'upashahar', name: 'Upashahar', area: 'Planned residential area' },
  { id: 'binodpur', name: 'Binodpur', area: 'Student and local housing area' },
  { id: 'sopura', name: 'Sopura', area: 'Industrial and residential area' },
  { id: 'kazla', name: 'Kazla', area: 'University nearby area' }
]
