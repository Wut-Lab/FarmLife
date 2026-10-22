// Bella's general store: what it sells and when it's open. Each thing is bought once.
export const STORE_HOURS = [8, 20]; // 8 AM to 8 PM
export const GOODS = {
  shoes: { name: 'Running Shoes', price: 400, icon: 'shoes', about: 'Walk a little faster.' },
  shovel: { name: 'Shovel', price: 250, icon: 'shovel', about: 'Digs things up. Uses coming soon.' },
};
export const storeOpen = minutes => minutes >= STORE_HOURS[0] * 60 && minutes < STORE_HOURS[1] * 60;
