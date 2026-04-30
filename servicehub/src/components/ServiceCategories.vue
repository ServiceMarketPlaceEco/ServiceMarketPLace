<template>
  <section class="categories">
    <div class="section-heading centered-heading">
        <p class="eyebrow">Rajshahi local help</p>
        <h2>Explore service categories</h2>
        <p>
            Choose the type of help you need first, then submit a request.
            Helpers can respond based on your location, task details and preferred time.
        </p>
    </div>

    <div class="category-grid">
      <article v-for="category in categories" :key="category.title" class="category-card">
        <img :src="category.image" :alt="category.title" />
        <div>
          <h3>{{ category.title }}</h3>
          <p>{{ category.description }}</p>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
const categories = [
  {
    title: 'Daily Bazaar Shopping',
    description: 'Request help with groceries, fresh produce, family shopping and local market runs.',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80'
  },
  {
    title: 'Medicine Pickup',
    description: 'Get help collecting medicine from pharmacies around Rajshahi.',
    image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=80'
  },
  {
    title: 'Food & Parcel Delivery',
    description: 'Send food, documents or small parcels across local areas safely.',
    image: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=900&q=80'
  },
  {
    title: 'Home Cleaning',
    description: 'Request cleaning support for rooms, kitchens, bathrooms or move-out cleaning.',
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80'
  },
  {
    title: 'Tutoring Support',
    description: 'Find local academic support for school, English, ICT and university preparation.',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80'
  },
  {
    title: 'Family & Elder Support',
    description: 'Request trusted local help for elderly family members or daily home support.',
    image: 'https://images.unsplash.com/photo-1576765608622-067973a79f53?auto=format&fit=crop&w=900&q=80'
  }
]
</script>