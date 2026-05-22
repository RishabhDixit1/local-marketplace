export const CROSSINGS_REPUBLIK_COORDS = {
  lat: 28.647,
  lng: 77.439,
  label: "Crossings Republik, Ghaziabad",
  pin: "201016",
};

export interface DemoProvider {
  id: string;
  name: string;
  headline: string;
  category: string;
  phone: string;
  avatarUrl: string;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  responseMinutes: number;
  verified: boolean;
  price: string;
  location: string;
  lat: number;
  lng: number;
  distanceKm: number;
  bio: string;
}

export const LOCAL_SOCIETIES = [
  "Mahagun Mascot",
  "Mahagun Montage",
  "Panchsheel Wellington",
  "Supertech Livingston",
  "Assotech The Nest",
  "Ajnara Gen X",
  "Saviour Greenisle",
  "Paramount Symphony",
  "Exotica Eastern Court",
  "Arihant Ambience",
];

export const LOCAL_MARKETS = [
  "Galleria Market 1",
  "Galleria Market 2",
  "Avantika Retail Street",
  "Panchsheel Square",
  "Paramount Spectrum",
  "City Plaza",
];

export const demoProviders: DemoProvider[] = [
  {
    id: "demo-elec-1",
    name: "Rahul Verma",
    headline: "⚡ 10+ years — Electrical repairs, wiring, switchboard",
    category: "Electrician",
    phone: "+91-9876543210",
    avatarUrl: "",
    rating: 4.8,
    reviewCount: 43,
    completedJobs: 218,
    responseMinutes: 12,
    verified: true,
    price: "₹150 - ₹500",
    location: "Mahagun Mascot, Crossings Republik",
    lat: 28.649,
    lng: 77.441,
    distanceKm: 0.4,
    bio: "Expert in house wiring, switchboard repair, fan installation, and circuit breaker fixes. Same-day service guaranteed in Crossings Republik.",
  },
  {
    id: "demo-plumb-1",
    name: "Suresh Kumar",
    headline: "🔧 15 years — Plumbing, pipe fitting, water heater",
    category: "Plumber",
    phone: "+91-9876543211",
    avatarUrl: "",
    rating: 4.7,
    reviewCount: 38,
    completedJobs: 185,
    responseMinutes: 18,
    verified: true,
    price: "₹200 - ₹600",
    location: "Panchsheel Wellington, Crossings Republik",
    lat: 28.645,
    lng: 77.437,
    distanceKm: 0.6,
    bio: "All plumbing work: tap repair, pipe leakage, geyser installation, bathroom fitting. Available 7 AM - 9 PM.",
  },
  {
    id: "demo-ac-1",
    name: "Vikash Sharma",
    headline: "❄️ AC repair, service, gas refill — all brands",
    category: "AC Repair",
    phone: "+91-9876543212",
    avatarUrl: "",
    rating: 4.9,
    reviewCount: 67,
    completedJobs: 342,
    responseMinutes: 8,
    verified: true,
    price: "₹250 - ₹1200",
    location: "Galleria Market 1, Crossings Republik",
    lat: 28.643,
    lng: 77.442,
    distanceKm: 0.8,
    bio: "Split AC, window AC, cassette AC — installation, repair, gas refill, deep cleaning. 30 min response in Crossings Republik.",
  },
  {
    id: "demo-ro-1",
    name: "Amit Singh",
    headline: "💧 RO & water purifier repair — all brands",
    category: "RO Repair",
    phone: "+91-9876543213",
    avatarUrl: "",
    rating: 4.6,
    reviewCount: 29,
    completedJobs: 156,
    responseMinutes: 22,
    verified: true,
    price: "₹150 - ₹800",
    location: "Avantika Retail Street, Crossings Republik",
    lat: 28.641,
    lng: 77.44,
    distanceKm: 1.1,
    bio: "RO membrane change, UV filter repair, auto-flush fitting, water tank cleaning. All brands: Kent, Aquaguard, Pureit.",
  },
  {
    id: "demo-carp-1",
    name: "Mohan Das",
    headline: "🪚 Carpentry, furniture assembly, minor fitting work",
    category: "Carpenter",
    phone: "+91-9876543214",
    avatarUrl: "",
    rating: 4.5,
    reviewCount: 22,
    completedJobs: 98,
    responseMinutes: 35,
    verified: false,
    price: "₹300 - ₹1500",
    location: "Supertech Livingston, Crossings Republik",
    lat: 28.648,
    lng: 77.435,
    distanceKm: 0.9,
    bio: "Furniture assembly, door repair, kitchen cabinet fitting, drilling and wall mounting. 5 years experience.",
  },
  {
    id: "demo-appl-1",
    name: "Deepak Yadav",
    headline: "🔌 Appliance repair — washing machine, fridge, oven",
    category: "Appliance Repair",
    phone: "+91-9876543215",
    avatarUrl: "",
    rating: 4.7,
    reviewCount: 34,
    completedJobs: 167,
    responseMinutes: 15,
    verified: true,
    price: "₹200 - ₹1000",
    location: "Ajnara Gen X, Crossings Republik",
    lat: 28.644,
    lng: 77.438,
    distanceKm: 0.7,
    bio: "Washing machine, refrigerator, microwave, oven — repair and service. Authorized service partner for multiple brands.",
  },
  {
    id: "demo-mobile-1",
    name: "Pankaj Gupta",
    headline: "📱 Mobile & laptop repair — screen, battery, software",
    category: "Mobile Repair",
    phone: "+91-9876543216",
    avatarUrl: "",
    rating: 4.4,
    reviewCount: 19,
    completedJobs: 312,
    responseMinutes: 10,
    verified: false,
    price: "₹100 - ₹2000",
    location: "Galleria Market 2, Crossings Republik",
    lat: 28.642,
    lng: 77.443,
    distanceKm: 1.0,
    bio: "iPhone, Android, laptop — screen replacement, battery change, software issues, data recovery. Walk-in or pickup.",
  },
  {
    id: "demo-bike-1",
    name: "Ravi Tyagi",
    headline: "🏍️ Bike & scooter repair — service, spare parts",
    category: "Bike Repair",
    phone: "+91-9876543217",
    avatarUrl: "",
    rating: 4.3,
    reviewCount: 15,
    completedJobs: 89,
    responseMinutes: 25,
    verified: false,
    price: "₹100 - ₹800",
    location: "NH-24 Service Belt, Crossings Republik",
    lat: 28.65,
    lng: 77.445,
    distanceKm: 1.5,
    bio: "Two-wheeler repair, oil change, tyre puncture, chain adjustment. All brands: Hero, Honda, Bajaj, TVS.",
  },
  {
    id: "demo-hardware-1",
    name: "Shyam Sunder Store",
    headline: "🏪 Hardware shop — pipes, wires, fittings, tools",
    category: "Hardware Shop",
    phone: "+91-9876543218",
    avatarUrl: "",
    rating: 4.2,
    reviewCount: 11,
    completedJobs: 0,
    responseMinutes: 5,
    verified: false,
    price: "₹10 - ₹5000",
    location: "Panchsheel Square, Crossings Republik",
    lat: 28.646,
    lng: 77.436,
    distanceKm: 0.5,
    bio: "Full range of hardware items: PVC pipes, electrical wires, switches, tools, paints, sanitary ware. Delivery within Crossings Republik.",
  },
  {
    id: "demo-electrical-shop-1",
    name: "Light & Power Electricals",
    headline: "💡 Electrical shop — wires, switches, fans, lights",
    category: "Electrical Shop",
    phone: "+91-9876543219",
    avatarUrl: "",
    rating: 4.6,
    reviewCount: 27,
    completedJobs: 0,
    responseMinutes: 8,
    verified: true,
    price: "₹20 - ₹3000",
    location: "Paramount Spectrum, Crossings Republik",
    lat: 28.647,
    lng: 77.441,
    distanceKm: 0.3,
    bio: "Electrical supplies: wires, switches, MCBs, fans, lights, geysers. Wholesale and retail. Free delivery for orders above ₹500.",
  },
];

export const emergencyHotline = "+91-1800-123-SERVIQ";

export interface MapPin {
  id: string;
  name: string;
  type: "society" | "market";
  lat: number;
  lng: number;
}

export const societyPins: MapPin[] = [
  { id: "soc-1", name: "Mahagun Mascot", type: "society", lat: 28.649, lng: 77.441 },
  { id: "soc-2", name: "Mahagun Montage", type: "society", lat: 28.651, lng: 77.438 },
  { id: "soc-3", name: "Panchsheel Wellington", type: "society", lat: 28.645, lng: 77.437 },
  { id: "soc-4", name: "Supertech Livingston", type: "society", lat: 28.648, lng: 77.435 },
  { id: "soc-5", name: "Assotech The Nest", type: "society", lat: 28.644, lng: 77.442 },
  { id: "soc-6", name: "Ajnara Gen X", type: "society", lat: 28.644, lng: 77.438 },
  { id: "soc-7", name: "Saviour Greenisle", type: "society", lat: 28.647, lng: 77.44 },
  { id: "soc-8", name: "Paramount Symphony", type: "society", lat: 28.646, lng: 77.437 },
  { id: "soc-9", name: "Exotica Eastern Court", type: "society", lat: 28.65, lng: 77.443 },
  { id: "soc-10", name: "Arihant Ambience", type: "society", lat: 28.643, lng: 77.44 },
];

export const marketPins: MapPin[] = [
  { id: "mkt-1", name: "Galleria Market 1", type: "market", lat: 28.643, lng: 77.442 },
  { id: "mkt-2", name: "Galleria Market 2", type: "market", lat: 28.642, lng: 77.443 },
  { id: "mkt-3", name: "Avantika Retail Street", type: "market", lat: 28.641, lng: 77.44 },
  { id: "mkt-4", name: "Panchsheel Square", type: "market", lat: 28.646, lng: 77.436 },
  { id: "mkt-5", name: "Paramount Spectrum", type: "market", lat: 28.647, lng: 77.441 },
  { id: "mkt-6", name: "City Plaza", type: "market", lat: 28.64, lng: 77.444 },
];

export const allMapPins: MapPin[] = [...societyPins, ...marketPins];
