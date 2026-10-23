// Bella's general store: what it sells and when it's open. Each thing is bought once.
// Things with a `slot` are worn (pause menu > Equipment) and only work while worn: speed multiplies walking speed, energy adds to max energy.
export const STORE_HOURS = [8, 20]; // 8 AM to 8 PM
export const WEAR_SLOTS = { hat: 'Hat', shirt: 'Shirt', pants: 'Pants', shoes: 'Shoes' };
export const GOODS = {
  shoes: { name: 'Running Shoes', short: 'Running Shoes', price: 400, icon: 'shoes', about: 'Walk 20% faster while worn.', slot: 'shoes', speed: 1.2, them: true },
  sneakers: { name: 'Lightweight Sneakers', short: 'Light Sneakers', price: 300, icon: 'sneakers', about: '+5 max energy while worn.', slot: 'shoes', energy: 5, them: true },
  shovel: { name: 'Shovel', price: 250, icon: 'shovel', about: 'Dig loose earth, move plants.' },
  // The wandering clothes salesman's stock (seller): extra is the chance, per piece worn, of an extra crop at each harvest.
  beanie: { name: 'Green Beanie', price: 150, icon: 'beanie', about: '+0.5% chance of a bonus crop.', slot: 'hat', extra: 0.005, seller: 'salesman' },
  longsleeve: { name: 'Green Long Sleeve Tee', short: 'Green Long Sleeve', price: 200, icon: 'longsleeve', about: '+0.5% chance of a bonus crop.', slot: 'shirt', extra: 0.005, seller: 'salesman' },
  jeans: { name: 'Blue Jeans', price: 250, icon: 'jeans', about: '+0.5% chance of a bonus crop.', slot: 'pants', extra: 0.005, seller: 'salesman', them: true },
  white_sneakers: { name: 'White Sneakers', price: 250, icon: 'white_sneakers', about: '+0.5% chance of a bonus crop.', slot: 'shoes', extra: 0.005, seller: 'salesman', them: true },
};
// What a keeper sells from GOODS: Bella has everything not marked with another seller.
export const goodsOf = keeper => Object.keys(GOODS).filter(id => (GOODS[id].seller ?? 'storekeeper') === keeper);
export const storeOpen = minutes => minutes >= STORE_HOURS[0] * 60 && minutes < STORE_HOURS[1] * 60;
