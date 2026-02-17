/**
 * World-Class JSON-LD Schema Generators
 * 
 * Comprehensive schema.org structured data for all major content types.
 * Follows Google's structured data guidelines for rich results.
 */

// ============================================================================
// ORGANIZATION & BRAND
// ============================================================================

export interface OrganizationSchema {
  name: string;
  url: string;
  logo?: string;
  description?: string;
  foundingDate?: string;
  founders?: { name: string; url?: string }[];
  address?: AddressSchema;
  contactPoint?: ContactPointSchema[];
  sameAs?: string[]; // Social profiles
}

export interface AddressSchema {
  streetAddress: string;
  addressLocality: string; // City
  addressRegion: string; // State
  postalCode: string;
  addressCountry: string;
}

export interface ContactPointSchema {
  telephone: string;
  contactType: 'customer service' | 'technical support' | 'sales' | 'billing';
  availableLanguage?: string[];
  areaServed?: string[];
}

export function generateOrganizationSchema(data: OrganizationSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.name,
    url: data.url,
    logo: data.logo,
    description: data.description,
    foundingDate: data.foundingDate,
    founder: data.founders?.map(f => ({
      '@type': 'Person',
      name: f.name,
      url: f.url,
    })),
    address: data.address ? {
      '@type': 'PostalAddress',
      streetAddress: data.address.streetAddress,
      addressLocality: data.address.addressLocality,
      addressRegion: data.address.addressRegion,
      postalCode: data.address.postalCode,
      addressCountry: data.address.addressCountry,
    } : undefined,
    contactPoint: data.contactPoint?.map(cp => ({
      '@type': 'ContactPoint',
      telephone: cp.telephone,
      contactType: cp.contactType,
      availableLanguage: cp.availableLanguage,
      areaServed: cp.areaServed,
    })),
    sameAs: data.sameAs,
  };
}

// ============================================================================
// WEBSITE & WEBPAGE
// ============================================================================

export interface WebSiteSchema {
  name: string;
  url: string;
  description?: string;
  publisher?: string;
  potentialAction?: {
    target: string;
    queryInput: string;
  };
}

export function generateWebSiteSchema(data: WebSiteSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: data.name,
    url: data.url,
    description: data.description,
    publisher: data.publisher ? {
      '@type': 'Organization',
      name: data.publisher,
    } : undefined,
    potentialAction: data.potentialAction ? {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: data.potentialAction.target,
      },
      'query-input': data.potentialAction.queryInput,
    } : undefined,
  };
}

// ============================================================================
// ARTICLE & BLOG POST
// ============================================================================

export interface ArticleSchema {
  headline: string;
  description: string;
  image: string | string[];
  datePublished: string;
  dateModified?: string;
  author: PersonSchema | PersonSchema[];
  publisher: {
    name: string;
    logo: string;
  };
  mainEntityOfPage?: string;
  wordCount?: number;
  articleSection?: string;
  keywords?: string[];
}

export interface PersonSchema {
  name: string;
  url?: string;
  image?: string;
  jobTitle?: string;
  sameAs?: string[];
}

export function generateArticleSchema(data: ArticleSchema) {
  const authors = Array.isArray(data.author) ? data.author : [data.author];
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.headline,
    description: data.description,
    image: data.image,
    datePublished: data.datePublished,
    dateModified: data.dateModified || data.datePublished,
    author: authors.map(a => ({
      '@type': 'Person',
      name: a.name,
      url: a.url,
      image: a.image,
      jobTitle: a.jobTitle,
      sameAs: a.sameAs,
    })),
    publisher: {
      '@type': 'Organization',
      name: data.publisher.name,
      logo: {
        '@type': 'ImageObject',
        url: data.publisher.logo,
      },
    },
    mainEntityOfPage: data.mainEntityOfPage ? {
      '@type': 'WebPage',
      '@id': data.mainEntityOfPage,
    } : undefined,
    wordCount: data.wordCount,
    articleSection: data.articleSection,
    keywords: data.keywords?.join(', '),
  };
}

export function generateBlogPostingSchema(data: ArticleSchema) {
  const schema = generateArticleSchema(data);
  return { ...schema, '@type': 'BlogPosting' };
}

export function generateNewsArticleSchema(data: ArticleSchema & { dateline?: string }) {
  const schema = generateArticleSchema(data);
  return { ...schema, '@type': 'NewsArticle', dateline: data.dateline };
}

// ============================================================================
// PRODUCT & E-COMMERCE
// ============================================================================

export interface ProductSchema {
  name: string;
  description: string;
  image: string | string[];
  sku?: string;
  mpn?: string;
  gtin?: string;
  brand?: string;
  offers: OfferSchema | OfferSchema[];
  aggregateRating?: AggregateRatingSchema;
  review?: ReviewSchema[];
  category?: string;
}

export interface OfferSchema {
  price: number | string;
  priceCurrency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder' | 'SoldOut' | 'BackOrder';
  priceValidUntil?: string;
  url?: string;
  seller?: string;
  itemCondition?: 'NewCondition' | 'UsedCondition' | 'RefurbishedCondition';
}

export interface AggregateRatingSchema {
  ratingValue: number;
  reviewCount?: number;
  ratingCount?: number;
  bestRating?: number;
  worstRating?: number;
}

export interface ReviewSchema {
  author: string;
  datePublished: string;
  reviewBody: string;
  reviewRating: {
    ratingValue: number;
    bestRating?: number;
  };
}

export function generateProductSchema(data: ProductSchema) {
  const offers = Array.isArray(data.offers) ? data.offers : [data.offers];
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.name,
    description: data.description,
    image: data.image,
    sku: data.sku,
    mpn: data.mpn,
    gtin: data.gtin,
    brand: data.brand ? {
      '@type': 'Brand',
      name: data.brand,
    } : undefined,
    category: data.category,
    offers: offers.map(o => ({
      '@type': 'Offer',
      price: o.price,
      priceCurrency: o.priceCurrency || 'USD',
      availability: `https://schema.org/${o.availability || 'InStock'}`,
      priceValidUntil: o.priceValidUntil,
      url: o.url,
      seller: o.seller ? {
        '@type': 'Organization',
        name: o.seller,
      } : undefined,
      itemCondition: o.itemCondition ? `https://schema.org/${o.itemCondition}` : undefined,
    })),
    aggregateRating: data.aggregateRating ? {
      '@type': 'AggregateRating',
      ratingValue: data.aggregateRating.ratingValue,
      reviewCount: data.aggregateRating.reviewCount,
      ratingCount: data.aggregateRating.ratingCount,
      bestRating: data.aggregateRating.bestRating || 5,
      worstRating: data.aggregateRating.worstRating || 1,
    } : undefined,
    review: data.review?.map(r => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: r.author,
      },
      datePublished: r.datePublished,
      reviewBody: r.reviewBody,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.reviewRating.ratingValue,
        bestRating: r.reviewRating.bestRating || 5,
      },
    })),
  };
}

// ============================================================================
// SOFTWARE APPLICATION (SaaS)
// ============================================================================

export interface SoftwareApplicationSchema {
  name: string;
  description: string;
  applicationCategory: 'BusinessApplication' | 'DeveloperApplication' | 'EducationalApplication' | 'GameApplication' | 'LifestyleApplication' | 'MultimediaApplication' | 'SocialNetworkingApplication' | 'UtilitiesApplication';
  operatingSystem?: string;
  offers: OfferSchema | OfferSchema[];
  aggregateRating?: AggregateRatingSchema;
  screenshot?: string | string[];
  featureList?: string[];
}

export function generateSoftwareApplicationSchema(data: SoftwareApplicationSchema) {
  const offers = Array.isArray(data.offers) ? data.offers : [data.offers];
  
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: data.name,
    description: data.description,
    applicationCategory: data.applicationCategory,
    operatingSystem: data.operatingSystem || 'Web',
    offers: offers.map(o => ({
      '@type': 'Offer',
      price: o.price,
      priceCurrency: o.priceCurrency || 'USD',
    })),
    aggregateRating: data.aggregateRating ? {
      '@type': 'AggregateRating',
      ratingValue: data.aggregateRating.ratingValue,
      reviewCount: data.aggregateRating.reviewCount,
      bestRating: data.aggregateRating.bestRating || 5,
    } : undefined,
    screenshot: data.screenshot,
    featureList: data.featureList,
  };
}

// ============================================================================
// FAQ PAGE
// ============================================================================

export interface FAQSchema {
  questions: { question: string; answer: string }[];
}

export function generateFAQSchema(data: FAQSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: data.questions.map(q => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  };
}

// ============================================================================
// HOW-TO
// ============================================================================

export interface HowToSchema {
  name: string;
  description: string;
  image?: string;
  totalTime?: string; // ISO 8601 duration, e.g., "PT30M"
  estimatedCost?: { currency: string; value: number };
  supply?: string[];
  tool?: string[];
  steps: {
    name: string;
    text: string;
    image?: string;
    url?: string;
  }[];
}

export function generateHowToSchema(data: HowToSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: data.name,
    description: data.description,
    image: data.image,
    totalTime: data.totalTime,
    estimatedCost: data.estimatedCost ? {
      '@type': 'MonetaryAmount',
      currency: data.estimatedCost.currency,
      value: data.estimatedCost.value,
    } : undefined,
    supply: data.supply?.map(s => ({
      '@type': 'HowToSupply',
      name: s,
    })),
    tool: data.tool?.map(t => ({
      '@type': 'HowToTool',
      name: t,
    })),
    step: data.steps.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name,
      text: step.text,
      image: step.image,
      url: step.url,
    })),
  };
}

// ============================================================================
// VIDEO
// ============================================================================

export interface VideoSchema {
  name: string;
  description: string;
  thumbnailUrl: string | string[];
  uploadDate: string;
  duration?: string; // ISO 8601, e.g., "PT1H30M"
  contentUrl?: string;
  embedUrl?: string;
  interactionStatistic?: {
    watchCount?: number;
    likeCount?: number;
    commentCount?: number;
  };
  publication?: {
    isLiveBroadcast: boolean;
    startDate?: string;
    endDate?: string;
  };
}

export function generateVideoSchema(data: VideoSchema) {
  const stats = data.interactionStatistic;
  
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: data.name,
    description: data.description,
    thumbnailUrl: data.thumbnailUrl,
    uploadDate: data.uploadDate,
    duration: data.duration,
    contentUrl: data.contentUrl,
    embedUrl: data.embedUrl,
    interactionStatistic: stats ? [
      stats.watchCount ? {
        '@type': 'InteractionCounter',
        interactionType: { '@type': 'WatchAction' },
        userInteractionCount: stats.watchCount,
      } : null,
      stats.likeCount ? {
        '@type': 'InteractionCounter',
        interactionType: { '@type': 'LikeAction' },
        userInteractionCount: stats.likeCount,
      } : null,
      stats.commentCount ? {
        '@type': 'InteractionCounter',
        interactionType: { '@type': 'CommentAction' },
        userInteractionCount: stats.commentCount,
      } : null,
    ].filter(Boolean) : undefined,
    publication: data.publication ? {
      '@type': 'BroadcastEvent',
      isLiveBroadcast: data.publication.isLiveBroadcast,
      startDate: data.publication.startDate,
      endDate: data.publication.endDate,
    } : undefined,
  };
}

// ============================================================================
// EVENT
// ============================================================================

export interface EventSchema {
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  location: {
    type: 'Place' | 'VirtualLocation';
    name?: string;
    address?: AddressSchema;
    url?: string; // For virtual events
  };
  image?: string | string[];
  performer?: { name: string; url?: string }[];
  organizer?: { name: string; url?: string };
  offers?: OfferSchema[];
  eventStatus?: 'EventScheduled' | 'EventCancelled' | 'EventPostponed' | 'EventRescheduled';
  eventAttendanceMode?: 'OfflineEventAttendanceMode' | 'OnlineEventAttendanceMode' | 'MixedEventAttendanceMode';
}

export function generateEventSchema(data: EventSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: data.name,
    description: data.description,
    startDate: data.startDate,
    endDate: data.endDate,
    image: data.image,
    eventStatus: data.eventStatus ? `https://schema.org/${data.eventStatus}` : undefined,
    eventAttendanceMode: data.eventAttendanceMode ? `https://schema.org/${data.eventAttendanceMode}` : undefined,
    location: data.location.type === 'VirtualLocation' ? {
      '@type': 'VirtualLocation',
      url: data.location.url,
    } : {
      '@type': 'Place',
      name: data.location.name,
      address: data.location.address ? {
        '@type': 'PostalAddress',
        ...data.location.address,
      } : undefined,
    },
    performer: data.performer?.map(p => ({
      '@type': 'Person',
      name: p.name,
      url: p.url,
    })),
    organizer: data.organizer ? {
      '@type': 'Organization',
      name: data.organizer.name,
      url: data.organizer.url,
    } : undefined,
    offers: data.offers?.map(o => ({
      '@type': 'Offer',
      price: o.price,
      priceCurrency: o.priceCurrency || 'USD',
      availability: `https://schema.org/${o.availability || 'InStock'}`,
      url: o.url,
      validFrom: o.priceValidUntil,
    })),
  };
}

// ============================================================================
// LOCAL BUSINESS
// ============================================================================

export interface LocalBusinessSchema {
  name: string;
  description: string;
  url: string;
  telephone: string;
  address: AddressSchema;
  geo?: { latitude: number; longitude: number };
  openingHours?: string[]; // e.g., ["Mo-Fr 09:00-17:00", "Sa 10:00-14:00"]
  priceRange?: string; // e.g., "$$"
  image?: string | string[];
  servesCuisine?: string[]; // For restaurants
  menu?: string; // URL to menu
  aggregateRating?: AggregateRatingSchema;
  review?: ReviewSchema[];
}

export function generateLocalBusinessSchema(data: LocalBusinessSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: data.name,
    description: data.description,
    url: data.url,
    telephone: data.telephone,
    image: data.image,
    priceRange: data.priceRange,
    servesCuisine: data.servesCuisine,
    menu: data.menu,
    address: {
      '@type': 'PostalAddress',
      streetAddress: data.address.streetAddress,
      addressLocality: data.address.addressLocality,
      addressRegion: data.address.addressRegion,
      postalCode: data.address.postalCode,
      addressCountry: data.address.addressCountry,
    },
    geo: data.geo ? {
      '@type': 'GeoCoordinates',
      latitude: data.geo.latitude,
      longitude: data.geo.longitude,
    } : undefined,
    openingHoursSpecification: data.openingHours?.map(parseOpeningHours).filter(Boolean),
    aggregateRating: data.aggregateRating ? {
      '@type': 'AggregateRating',
      ratingValue: data.aggregateRating.ratingValue,
      reviewCount: data.aggregateRating.reviewCount,
      bestRating: data.aggregateRating.bestRating || 5,
    } : undefined,
    review: data.review?.map(r => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author },
      datePublished: r.datePublished,
      reviewBody: r.reviewBody,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.reviewRating.ratingValue,
      },
    })),
  };
}

function parseOpeningHours(hours: string) {
  // Parse "Mo-Fr 09:00-17:00" format
  const match = hours.match(/^([A-Za-z,-]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (!match) return null;
  
  const dayMap: Record<string, string> = {
    'Mo': 'Monday', 'Tu': 'Tuesday', 'We': 'Wednesday',
    'Th': 'Thursday', 'Fr': 'Friday', 'Sa': 'Saturday', 'Su': 'Sunday',
  };
  
  const dayPart = match[1];
  const opens = match[2];
  const closes = match[3];
  
  // Handle ranges like "Mo-Fr"
  if (dayPart.includes('-')) {
    const [start, end] = dayPart.split('-');
    const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
    const startIdx = days.indexOf(start);
    const endIdx = days.indexOf(end);
    const dayOfWeek = days.slice(startIdx, endIdx + 1).map(d => dayMap[d]);
    return { '@type': 'OpeningHoursSpecification', dayOfWeek, opens, closes };
  }
  
  return {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: dayPart.split(',').map(d => dayMap[d.trim()]),
    opens,
    closes,
  };
}

// ============================================================================
// BREADCRUMB
// ============================================================================

export interface BreadcrumbSchema {
  items: { name: string; url: string }[];
}

export function generateBreadcrumbSchema(data: BreadcrumbSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: data.items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ============================================================================
// JOB POSTING
// ============================================================================

export interface JobPostingSchema {
  title: string;
  description: string;
  datePosted: string;
  validThrough?: string;
  employmentType?: ('FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'TEMPORARY' | 'INTERN')[];
  hiringOrganization: {
    name: string;
    url?: string;
    logo?: string;
  };
  jobLocation?: {
    address: AddressSchema;
  };
  jobLocationType?: 'TELECOMMUTE';
  baseSalary?: {
    value: { minValue: number; maxValue: number } | number;
    currency: string;
    unitText: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  };
  experienceRequirements?: string;
  educationRequirements?: string;
  skills?: string[];
}

export function generateJobPostingSchema(data: JobPostingSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: data.title,
    description: data.description,
    datePosted: data.datePosted,
    validThrough: data.validThrough,
    employmentType: data.employmentType,
    hiringOrganization: {
      '@type': 'Organization',
      name: data.hiringOrganization.name,
      sameAs: data.hiringOrganization.url,
      logo: data.hiringOrganization.logo,
    },
    jobLocation: data.jobLocation ? {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...data.jobLocation.address,
      },
    } : undefined,
    jobLocationType: data.jobLocationType,
    baseSalary: data.baseSalary ? {
      '@type': 'MonetaryAmount',
      currency: data.baseSalary.currency,
      value: typeof data.baseSalary.value === 'number' ? {
        '@type': 'QuantitativeValue',
        value: data.baseSalary.value,
        unitText: data.baseSalary.unitText,
      } : {
        '@type': 'QuantitativeValue',
        minValue: data.baseSalary.value.minValue,
        maxValue: data.baseSalary.value.maxValue,
        unitText: data.baseSalary.unitText,
      },
    } : undefined,
    experienceRequirements: data.experienceRequirements,
    educationRequirements: data.educationRequirements ? {
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: data.educationRequirements,
    } : undefined,
    skills: data.skills,
  };
}

// ============================================================================
// COURSE
// ============================================================================

export interface CourseSchema {
  name: string;
  description: string;
  provider: {
    name: string;
    url?: string;
  };
  offers?: OfferSchema;
  coursePrerequisites?: string[];
  educationalLevel?: string;
  timeRequired?: string; // ISO 8601 duration
  image?: string;
  aggregateRating?: AggregateRatingSchema;
}

export function generateCourseSchema(data: CourseSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: data.name,
    description: data.description,
    provider: {
      '@type': 'Organization',
      name: data.provider.name,
      sameAs: data.provider.url,
    },
    offers: data.offers ? {
      '@type': 'Offer',
      price: data.offers.price,
      priceCurrency: data.offers.priceCurrency || 'USD',
      availability: `https://schema.org/${data.offers.availability || 'InStock'}`,
    } : undefined,
    coursePrerequisites: data.coursePrerequisites,
    educationalLevel: data.educationalLevel,
    timeRequired: data.timeRequired,
    image: data.image,
    aggregateRating: data.aggregateRating ? {
      '@type': 'AggregateRating',
      ratingValue: data.aggregateRating.ratingValue,
      reviewCount: data.aggregateRating.reviewCount,
    } : undefined,
  };
}

// ============================================================================
// RECIPE
// ============================================================================

export interface RecipeSchema {
  name: string;
  description: string;
  image: string | string[];
  author: { name: string; url?: string };
  datePublished: string;
  prepTime?: string; // ISO 8601 duration
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string; // e.g., "4 servings"
  recipeCategory?: string; // e.g., "Dessert"
  recipeCuisine?: string; // e.g., "Italian"
  recipeIngredient: string[];
  recipeInstructions: { name?: string; text: string }[];
  nutrition?: {
    calories?: string;
    fatContent?: string;
    proteinContent?: string;
    carbohydrateContent?: string;
  };
  aggregateRating?: AggregateRatingSchema;
  video?: VideoSchema;
}

export function generateRecipeSchema(data: RecipeSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: data.name,
    description: data.description,
    image: data.image,
    author: {
      '@type': 'Person',
      name: data.author.name,
      url: data.author.url,
    },
    datePublished: data.datePublished,
    prepTime: data.prepTime,
    cookTime: data.cookTime,
    totalTime: data.totalTime,
    recipeYield: data.recipeYield,
    recipeCategory: data.recipeCategory,
    recipeCuisine: data.recipeCuisine,
    recipeIngredient: data.recipeIngredient,
    recipeInstructions: data.recipeInstructions.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name,
      text: step.text,
    })),
    nutrition: data.nutrition ? {
      '@type': 'NutritionInformation',
      calories: data.nutrition.calories,
      fatContent: data.nutrition.fatContent,
      proteinContent: data.nutrition.proteinContent,
      carbohydrateContent: data.nutrition.carbohydrateContent,
    } : undefined,
    aggregateRating: data.aggregateRating ? {
      '@type': 'AggregateRating',
      ratingValue: data.aggregateRating.ratingValue,
      reviewCount: data.aggregateRating.reviewCount,
    } : undefined,
    video: data.video ? generateVideoSchema(data.video) : undefined,
  };
}

// ============================================================================
// BOOK
// ============================================================================

export interface BookSchema {
  name: string;
  description: string;
  author: { name: string; url?: string } | { name: string; url?: string }[];
  isbn?: string;
  numberOfPages?: number;
  bookFormat?: 'Hardcover' | 'Paperback' | 'EBook' | 'AudioBook';
  publisher?: string;
  datePublished?: string;
  image?: string;
  inLanguage?: string;
  aggregateRating?: AggregateRatingSchema;
  offers?: OfferSchema;
}

export function generateBookSchema(data: BookSchema) {
  const authors = Array.isArray(data.author) ? data.author : [data.author];
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: data.name,
    description: data.description,
    author: authors.map(a => ({
      '@type': 'Person',
      name: a.name,
      url: a.url,
    })),
    isbn: data.isbn,
    numberOfPages: data.numberOfPages,
    bookFormat: data.bookFormat ? `https://schema.org/${data.bookFormat}` : undefined,
    publisher: data.publisher ? {
      '@type': 'Organization',
      name: data.publisher,
    } : undefined,
    datePublished: data.datePublished,
    image: data.image,
    inLanguage: data.inLanguage,
    aggregateRating: data.aggregateRating ? {
      '@type': 'AggregateRating',
      ratingValue: data.aggregateRating.ratingValue,
      reviewCount: data.aggregateRating.reviewCount,
    } : undefined,
    offers: data.offers ? {
      '@type': 'Offer',
      price: data.offers.price,
      priceCurrency: data.offers.priceCurrency || 'USD',
      availability: `https://schema.org/${data.offers.availability || 'InStock'}`,
    } : undefined,
  };
}

// ============================================================================
// SPEAKABLE (for Google Assistant)
// ============================================================================

export interface SpeakableSchema {
  url: string;
  cssSelector?: string[];
  xpath?: string[];
}

export function generateSpeakableSchema(data: SpeakableSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: data.cssSelector,
      xpath: data.xpath,
    },
    url: data.url,
  };
}

// ============================================================================
// SITELINKS SEARCHBOX
// ============================================================================

export interface SitelinksSearchboxSchema {
  url: string;
  searchUrl: string;
  queryInput?: string;
}

export function generateSitelinksSearchboxSchema(data: SitelinksSearchboxSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: data.url,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: data.searchUrl,
      },
      'query-input': data.queryInput || 'required name=search_term_string',
    },
  };
}

// ============================================================================
// ALL SCHEMAS EXPORT
// ============================================================================

export const Schemas = {
  organization: generateOrganizationSchema,
  webSite: generateWebSiteSchema,
  article: generateArticleSchema,
  blogPosting: generateBlogPostingSchema,
  newsArticle: generateNewsArticleSchema,
  product: generateProductSchema,
  softwareApplication: generateSoftwareApplicationSchema,
  faq: generateFAQSchema,
  howTo: generateHowToSchema,
  video: generateVideoSchema,
  event: generateEventSchema,
  localBusiness: generateLocalBusinessSchema,
  breadcrumb: generateBreadcrumbSchema,
  jobPosting: generateJobPostingSchema,
  course: generateCourseSchema,
  recipe: generateRecipeSchema,
  book: generateBookSchema,
  speakable: generateSpeakableSchema,
  sitelinksSearchbox: generateSitelinksSearchboxSchema,
};
