<template>
  <section class="taskrabbit-flow">
    <template v-if="mode === 'services'">
      <div class="flow-heading">
        <p class="eyebrow">Rajshahi Service Hub</p>
        <h1>Book trusted local help around Rajshahi</h1>
        <p>
          Choose a service category first. Then describe your request so local helpers can respond.
        </p>
      </div>

      <div class="service-grid">
        <article
          v-for="service in services"
          :key="service.title"
          class="service-card"
          @click="$emit('select-service', service)"
        >
          <img :src="service.image" :alt="service.title" />
          <div>
            <h3>{{ service.title }}</h3>
            <p>{{ service.description }}</p>
            <span>View tasks →</span>
          </div>
        </article>
      </div>
    </template>

    <template v-else>
      <button class="back-btn" @click="$emit('back')">← Back to services</button>

      <div class="detail-layout">
        <div class="detail-copy">
          <p class="eyebrow">{{ selectedService.title }}</p>
          <h1>What would you like help with?</h1>
          <p>{{ selectedService.longDescription }}</p>

          <div class="task-list">
            <button
              v-for="task in selectedService.tasks"
              :key="task"
              @click="$emit('select-task', task)"
            >
              {{ task }}
            </button>
          </div>
        </div>

        <div class="detail-image-card">
          <img :src="selectedService.image" :alt="selectedService.title" />
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
defineProps({
  mode: {
    type: String,
    default: 'services'
  },
  selectedService: {
    type: Object,
    default: null
  }
})

defineEmits(['select-service', 'select-task', 'back'])

const services = [
  {
    title: 'Daily Bazaar Shopping',
    description: 'Groceries, fresh produce, family shopping and local market runs.',
    longDescription: 'Tell us what items you need, preferred bazaar, delivery area and budget.',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
    tasks: [
      'Fresh grocery shopping',
      'Family bazaar run',
      'Fruit and vegetable pickup',
      'Rice, oil and household essentials',
      'Custom shopping request'
    ]
  },
  {
    title: 'Medicine Pickup',
    description: 'Collect medicine from pharmacies around Rajshahi.',
    longDescription: 'Request safe medicine pickup from a local pharmacy. You can add pharmacy name and prescription details.',
    image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=80',
    tasks: [
      'Prescription medicine pickup',
      'Pharmacy order collection',
      'Emergency medicine delivery',
      'Monthly medicine refill',
      'Custom medicine request'
    ]
  },
  {
    title: 'Food & Parcel Delivery',
    description: 'Send food, documents or small parcels across local areas.',
    longDescription: 'Request local delivery support for food, documents, small packages or personal items.',
    image: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=900&q=80',
    tasks: [
      'Food delivery',
      'Document delivery',
      'Small parcel delivery',
      'University area delivery',
      'Custom delivery request'
    ]
  },
  {
    title: 'Home Cleaning',
    description: 'Room, kitchen, bathroom and move-out cleaning support.',
    longDescription: 'Choose the cleaning support you need and describe your home size, preferred time and cleaning requirements.',
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
    tasks: [
      'Basic room cleaning',
      'Kitchen cleaning',
      'Bathroom cleaning',
      'Deep cleaning',
      'Move-out cleaning'
    ]
  },
  {
    title: 'Tutoring Support',
    description: 'School, English, ICT and university preparation support.',
    longDescription: 'Request tutoring support based on subject, education level, preferred location and learning goal.',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
    tasks: [
      'School tutoring',
      'English tutoring',
      'ICT tutoring',
      'University assignment support',
      'Exam preparation'
    ]
  },
  {
    title: 'Family & Elder Support',
    description: 'Trusted help for elderly family members or daily home support.',
    longDescription: 'Request respectful family support, elder assistance, errands or daily household help.',
    image: 'https://images.unsplash.com/photo-1576765608622-067973a79f53?auto=format&fit=crop&w=900&q=80',
    tasks: [
      'Elder check-in support',
      'Family errands',
      'Appointment support',
      'Household assistance',
      'Custom family support'
    ]
  }
]
</script>