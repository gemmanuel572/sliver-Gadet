export type Product = {
  id: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  images?: string[];
  createdAt?: string;
  description: string;
  colors: string[];
  storage: string[];
  conditions: {
    batteryHealth: string;
    screen: string;
    faceIdOrFingerprint: string;
    cameras: string;
    speakers: string;
    microphone: string;
    chargingPort: string;
    network: string;
    wifi: string;
    bluetooth: string;
    trueTone: string;
  };
};

export const products: Product[] = [
  // IPHONE 15 PRO MAX
  {
    id: "iphone-15-pro-max",
    name: "iPhone 15 Pro Max",
    brand: "Apple",
    price: 1250000,

    image:
      "https://static01.galaxus.com/productimages/4/9/9/6/7/0/2/9/6/2/5/8/8/2/3/0/7/7/a3ca2b7a-b182-49e1-80e3-eda7d00c55c0.jpg_sea.jpeg",

    description: "Premium Apple smartphone.",

    colors: [
      "Natural Titanium",
      "Blue Titanium",
      "White Titanium",
      "Black Titanium",
    ],

    storage: ["256GB", "512GB", "1TB"],

    conditions: {
      batteryHealth: "Not yet verified",
      screen: "Not yet verified",
      faceIdOrFingerprint: "Not yet verified",
      cameras: "Not yet verified",
      speakers: "Not yet verified",
      microphone: "Not yet verified",
      chargingPort: "Not yet verified",
      network: "Not yet verified",
      wifi: "Not yet verified",
      bluetooth: "Not yet verified",
      trueTone: "Not yet verified",
    },
  },

  // IPHONE 14 PRO
  {
    id: "iphone-14-pro",
    name: "iPhone 14 Pro",
    brand: "Apple",
    price: 850000,

    image:
      "https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=700",

    description: "Powerful Apple smartphone.",

    colors: [
      "Deep Purple",
      "Gold",
      "Silver",
      "Space Black",
    ],

    storage: ["128GB", "256GB", "512GB", "1TB"],

    conditions: {
      batteryHealth: "Not yet verified",
      screen: "Not yet verified",
      faceIdOrFingerprint: "Not yet verified",
      cameras: "Not yet verified",
      speakers: "Not yet verified",
      microphone: "Not yet verified",
      chargingPort: "Not yet verified",
      network: "Not yet verified",
      wifi: "Not yet verified",
      bluetooth: "Not yet verified",
      trueTone: "Not yet verified",
    },
  },

  // SAMSUNG GALAXY S24 ULTRA
  {
    id: "samsung-s24-ultra",
    name: "Samsung Galaxy S24 Ultra",
    brand: "Samsung",
    price: 1100000,

    image:
      "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=700",

    description: "Premium Samsung Galaxy smartphone.",

    colors: [
      "Titanium Gray",
      "Titanium Black",
      "Titanium Violet",
      "Titanium Yellow",
    ],

    storage: ["256GB", "512GB", "1TB"],

    conditions: {
      batteryHealth: "Not yet verified",
      screen: "Not yet verified",
      faceIdOrFingerprint: "Not yet verified",
      cameras: "Not yet verified",
      speakers: "Not yet verified",
      microphone: "Not yet verified",
      chargingPort: "Not yet verified",
      network: "Not yet verified",
      wifi: "Not yet verified",
      bluetooth: "Not yet verified",
      trueTone: "Not applicable",
    },
  },

  // IPHONE 13
  {
    id: "iphone-13",
    name: "iPhone 13",
    brand: "Apple",
    price: 480000,

    // UPDATED IPHONE 13 IMAGE
    image:
      "https://www.apple.com/newsroom/images/product/iphone/geo/Apple_iphone13_hero_geo_09142021_inline.jpg.large.jpg",

    description: "Reliable Apple smartphone.",

    colors: [
      "Midnight",
      "Blue",
      "Pink",
      "Starlight",
      "Green",
      "Red",
    ],

    storage: ["128GB", "256GB", "512GB"],

    conditions: {
      batteryHealth: "Not yet verified",
      screen: "Not yet verified",
      faceIdOrFingerprint: "Not yet verified",
      cameras: "Not yet verified",
      speakers: "Not yet verified",
      microphone: "Not yet verified",
      chargingPort: "Not yet verified",
      network: "Not yet verified",
      wifi: "Not yet verified",
      bluetooth: "Not yet verified",
      trueTone: "Not yet verified",
    },
  },
];
