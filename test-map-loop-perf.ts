const NUM_ITEMS = 50000

function generateData() {
  const items = []
  for (let i = 0; i < NUM_ITEMS; i++) {
    items.push({
      id: `id-${i}`,
      name: `Name ${i}`,
      type: 'person',
      person: { email: `user${i}@example.com` }
    })
  }
  return items
}

function useMap(items: any[]) {
  return items.map((user: any) => ({
    id: user.id,
    type: user.type,
    name: user.name || 'Unknown',
    avatar_url: user.avatar_url,
    email: user.type === 'person' ? user.person?.email : undefined
  }))
}

function useForLoop(items: any[]) {
  const result = new Array(items.length)
  for (let i = 0; i < items.length; i++) {
    const user = items[i]
    result[i] = {
      id: user.id,
      type: user.type,
      name: user.name || 'Unknown',
      avatar_url: user.avatar_url,
      email: user.type === 'person' ? user.person?.email : undefined
    }
  }
  return result
}

const data = generateData()

console.log('Warming up...')
useMap(data)
useForLoop(data)

console.log('Running benchmark...')

const t1 = performance.now()
for (let i = 0; i < 100; i++) useMap(data)
const t2 = performance.now()

const t3 = performance.now()
for (let i = 0; i < 100; i++) useForLoop(data)
const t4 = performance.now()

console.log(`Array.map: ${t2 - t1}ms`)
console.log(`for-loop: ${t4 - t3}ms`)
