// ═══════════════════════════════════════════
//  محجوز — Sample Data for Testing
// ═══════════════════════════════════════════

const SAMPLE_CATEGORIES = [
  { icon: '🏨', name: 'فنادق', section: 'bookings' },
  { icon: '🚗', name: 'تأجير سيارات', section: 'bookings' },
  { icon: '⚡', name: 'كهربائي', section: 'services' },
  { icon: '🚱', name: 'سباك', section: 'services' },
  { icon: '💐', name: 'حدائق', section: 'services' },
  { icon: '📸', name: 'مصور', section: 'services' },
  { icon: '💊', name: 'صيدليات', section: 'stores' },
];

const SAMPLE_SERVICES = [
  { 
    catId: 'hotel', name: 'فندق النخيل', provider: 'إدارة الفندق',
    icon: '🏨', desc: 'فندق 5 نجوم بخدمات عالية', price: 500,
    contact: '0501234567', section: 'bookings'
  },
  {
    catId: 'car', name: 'تأجير تويوتا كامري', provider: 'شركة النور',
    icon: '🚗', desc: 'سيارة حديثة بحالة ممتازة', price: 150,
    contact: '0507654321', section: 'bookings'
  },
  {
    catId: 'electric', name: 'كهربائي محترف', provider: 'أحمد الكهربائي',
    icon: '⚡', desc: 'صيانة وإصلاح كهربائي منزلي', price: 100,
    contact: '0509876543', section: 'services'
  },
  {
    catId: 'plumber', name: 'سباك متخصص', provider: 'محمود السباك',
    icon: '🚱', desc: 'تركيب وصيانة أنابيب المياه', price: 120,
    contact: '0503456789', section: 'services'
  },
  {
    catId: 'photo', name: 'تصوير فوتوغرافي', provider: 'أحمد المصور',
    icon: '📸', desc: 'تصوير افراح وعقود وحفلات', price: 800,
    contact: '0502468135', section: 'services'
  },
  {
    catId: 'pharmacy', name: 'صيدلية النور', provider: 'محمد صيدلاني',
    icon: '💊', desc: 'أدوية وعقاقير معتمدة مع توصيل', price: 0,
    contact: '0505555555', section: 'stores'
  },
];

const SAMPLE_ADS = [
  {
    title: 'عرض فندق النخيل الحصري',
    description: 'احصل على خصم 20% على كل الحجوزات',
    type: 'direct_order',
    serviceId: 'svc1',
    price: 500,
    active: true,
    imageBase64: null,
  },
  {
    title: 'تأجير سيارات بأسعار مميزة',
    description: 'أفضل الأسعار في المدينة مع ضمان الجودة',
    type: 'redirect',
    targetUrl: 'https://example.com',
    price: 0,
    active: true,
    imageBase64: null,
  },
];

async function seedSampleData() {
  console.log('🌱 جاري إضافة بيانات تجريبية...');
  
  try {
    // Add Categories
    for (const cat of SAMPLE_CATEGORIES) {
      const colName = (cat.section === 'bookings') ? 'categories' : 'professions_categories';
      const exists = await fsQuery(colName, 'name', '==', cat.name);
      if (!exists.length) {
        await fsAdd(colName, cat);
        console.log(`✅ تم إضافة تصنيف: ${cat.name}`);
      }
    }
    
    // Add Services
    const [catsBookings, catsProfs] = await Promise.all([
      fsGetAll('categories').catch(()=>[]),
      fsGetAll('professions_categories').catch(()=>[])
    ]);
    const cats = [
      ...catsBookings.map(c => ({ ...c, section: c.section || 'bookings' })),
      ...catsProfs.map(c => ({ ...c, section: c.section || 'professions' }))
    ];
    for (let i = 0; i < SAMPLE_SERVICES.length && i < cats.length; i++) {
      const svc = SAMPLE_SERVICES[i];
      const exists = await fsQuery('services', 'name', '==', svc.name);
      if (!exists.length) {
        svc.catId = cats[i].id;
        await fsAdd('services', svc);
        console.log(`✅ تم إضافة خدمة: ${svc.name}`);
      }
    }
    
    // Add Sample Ads
    for (const ad of SAMPLE_ADS) {
      const exists = await fsQuery('ads', 'title', '==', ad.title);
      if (!exists.length) {
        await fsAdd('ads', ad);
        console.log(`✅ تم إضافة إعلان: ${ad.title}`);
      }
    }
    
    console.log('✨ انتهت عملية إضافة البيانات التجريبية');
  } catch (e) {
    console.error('❌ خطأ في إضافة البيانات:', e.message);
  }
}

// Trigger seed on first load (if needed)
// seedSampleData();
