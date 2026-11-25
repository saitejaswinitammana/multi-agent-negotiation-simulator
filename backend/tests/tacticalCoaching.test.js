
const assert = require('node:assert/strict');
const { generateTacticalCoaching } = require('../src/services/tacticalCoachingService');

let passed = 0;

function test(name, callback) {
  try {
    callback();
    console.log(`PASS: ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`FAIL: ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

// Test 4.1: Simulation Mode - separate participant feedback
test('4.1 Simulation Mode: separate buyer and seller coaching', () => {
  const simulation = {
    id: 'test-simulation-41',
    scenario_id: 'vendor-pricing',
    status: 'COMPLETED',
    agents: [
      { name: 'Procurement Director', role: 'Buyer', personality: 'Collaborative' },
      { name: 'Sales Executive', role: 'Seller', personality: 'Aggressive' },
    ],
    messages: [
      { sender_type: 'AGENT', sender_name: 'Sales Executive', sender_role: 'Seller', message: 'Opening price', offer_value: 150000, action: 'OFFER', round_number: 1 },
      { sender_type: 'AGENT', sender_name: 'Procurement Director', sender_role: 'Buyer', message: 'Buyer proposal', offer_value: 100000, action: 'OFFER', round_number: 1 },
      { sender_type: 'AGENT', sender_name: 'Sales Executive', sender_role: 'Seller', message: 'Reduced price', offer_value: 120000, action: 'COUNTER_OFFER', round_number: 2 },
      { sender_type: 'AGENT', sender_name: 'Procurement Director', sender_role: 'Buyer', message: 'Revised proposal', offer_value: 110000, action: 'COUNTER_OFFER', round_number: 2 },
    ],
  };

  const report = generateTacticalCoaching(simulation);

  assert.equal(report.mode, 'SIMULATION');
  assert.equal(report.participants.length, 2);
  assert.equal(report.participants[0].role, 'Buyer');
  assert.equal(report.participants[1].role, 'Seller');
  assert.notDeepEqual(
    report.participants[0].actionable_takeaways,
    report.participants[1].actionable_takeaways
  );
  const buyer = report.participants[0];
  const seller = report.participants[1];

  assert.ok(
    buyer.areas_for_improvement.some((item) =>
      item.includes('Collaborative Buyer critique')
    ),
    'Expected a specific critique for the Collaborative Buyer'
  );

  assert.ok(
    seller.areas_for_improvement.some((item) =>
      item.includes('Aggressive Seller critique')
    ),
    'Expected a specific critique for the Aggressive Seller'
  );
});

// Test 4.2: Practice Mode - strong buyer opening anchor
test('4.2 Practice Mode Buyer: recognise a strong opening anchor', () => {
  const simulation = {
    id: 'test-practice-42',
    scenario_id: 'vendor-pricing',
    status: 'RUNNING',
    agents: [
      { name: 'Human Buyer', role: 'Buyer', personality: 'Human', is_human: true },
      { name: 'Vendor', role: 'Seller', personality: 'Collaborative' },
    ],
    messages: [
      { sender_type: 'AGENT', sender_name: 'Vendor', sender_role: 'Seller', offer_value: 120000, action: 'OFFER', round_number: 1 },
      { sender_type: 'HUMAN', sender_name: 'Human Buyer', sender_role: 'Buyer', offer_value: 90000, action: 'OFFER', round_number: 1 },
    ],
  };

  const report = generateTacticalCoaching(simulation);
  const buyer = report.participants.find((p) => p.role === 'Buyer');

  assert.equal(report.mode, 'PRACTICE');
  assert.ok(buyer);
  assert.ok(
    buyer.strengths.some((item) => item.toLowerCase().includes('opening anchoring')),
    'Expected strong opening anchoring feedback'
  );
});

// Test 4.3: Practice Mode Seller - rapid price reduction
test('4.3 Practice Mode Seller: detect rapid margin erosion', () => {
  const simulation = {
    id: 'test-practice-43',
    scenario_id: 'vendor-pricing',
    status: 'RUNNING',
    agents: [
      { name: 'Human Seller', role: 'Seller', personality: 'Human', is_human: true },
      { name: 'Buyer', role: 'Buyer', personality: 'Collaborative' },
    ],
    messages: [
      { sender_type: 'HUMAN', sender_name: 'Human Seller', sender_role: 'Seller', offer_value: 150000, action: 'OFFER', round_number: 1 },
      { sender_type: 'AGENT', sender_name: 'Buyer', sender_role: 'Buyer', offer_value: 100000, action: 'OFFER', round_number: 1 },
      { sender_type: 'HUMAN', sender_name: 'Human Seller', sender_role: 'Seller', offer_value: 120000, action: 'COUNTER_OFFER', round_number: 2 },
    ],
  };

  const report = generateTacticalCoaching(simulation);
  const seller = report.participants.find((p) => p.role === 'Seller');

  assert.ok(seller);
  assert.ok(
    seller.areas_for_improvement.some((item) => item.toLowerCase().includes('margin erosion')),
    'Expected rapid margin erosion feedback'
  );
});

// Test 4.4: Practice Mode - pragmatic movement toward compromise
test('4.4 Practice Mode Job Offer: recognise deadlock recovery', () => {
  const simulation = {
    id: 'test-practice-44',
    scenario_id: 'job-offer',
    status: 'DEADLOCK',
    agents: [
      { name: 'Human Candidate', role: 'Candidate', personality: 'Human', is_human: true },
      { name: 'Recruiter', role: 'Recruiter', personality: 'Risk-Averse' },
    ],
    messages: [
      { sender_type: 'AGENT', sender_name: 'Recruiter', sender_role: 'Recruiter', offer_value: 80000, action: 'OFFER', round_number: 1 },
      { sender_type: 'HUMAN', sender_name: 'Human Candidate', sender_role: 'Candidate', offer_value: 120000, action: 'OFFER', round_number: 1 },
      { sender_type: 'HUMAN', sender_name: 'Human Candidate', sender_role: 'Candidate', offer_value: 100000, action: 'COUNTER_OFFER', round_number: 2 },
    ],
  };

  const report = generateTacticalCoaching(simulation);

  assert.equal(report.status, 'DEADLOCK');
  assert.ok(
    report.deadlock_recovery &&
    report.deadlock_recovery.toLowerCase().includes('pragmatic deadlock recovery'),
    'Expected pragmatic deadlock recovery feedback'
  );
});

console.log(`\n${passed}/4 coaching tests passed.`);
