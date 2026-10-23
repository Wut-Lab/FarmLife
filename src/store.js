// Bella's general store: what it sells and when it's open. Each thing is bought once.
// Things with a `slot` are worn (pause menu > Equipment) and only work while worn: speed multiplies walking speed, energy adds to max energy.
export const STORE_HOURS = [8, 20]; // 8 AM to 8 PM
export const WEAR_SLOTS = { hat: 'Hat', shirt: 'Shirt', pants: 'Pants', shoes: 'Shoes' };
export const GOODS = {
  shoes: { name: 'Running Shoes', short: 'Running Shoes', price: 400, icon: 'shoes', about: 'Walk 20% faster while worn.', slot: 'shoes', speed: 1.2 },
  sneakers: { name: 'Lightweight Sneakers', short: 'Light Sneakers', price: 300, icon: 'sneakers', about: '+5 max energy while worn.', slot: 'shoes', energy: 5 },
  shovel: { name: 'Shovel', price: 250, icon: 'shovel', about: 'Dig loose earth, move plants.' },
};
export const storeOpen = minutes => minutes >= STORE_HOURS[0] * 60 && minutes < STORE_HOURS[1] * 60;
