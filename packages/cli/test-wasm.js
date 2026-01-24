#!/usr/bin/env node
/**
 * WASM Integration Test
 *
 * Tests that the WASM-protected audit engine works correctly.
 * Run from packages/cli: node test-wasm.js
 */

const { initEngine, runAudit, getTier, getChecksLimit, isReady } = require('./dist/wasm-engine.js');

const testHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Page - RankCLI WASM Test</title>
    <meta name="description" content="This is a test page for verifying the WASM audit engine works correctly.">
    <link rel="canonical" href="https://example.com/test">
</head>
<body>
    <h1>Test Page Heading</h1>
    <p>This is some test content to verify the audit engine is working.</p>
    <a href="/about">About Us</a>
    <a href="/contact">Contact</a>
</body>
</html>
`;

async function runTests() {
    console.log('='.repeat(50));
    console.log('RankCLI WASM Integration Tests');
    console.log('='.repeat(50));
    console.log('');

    let passed = 0;
    let failed = 0;

    // Test 1: Engine not ready before init
    try {
        const ready = await isReady();
        if (ready === false) {
            console.log('✓ Test 1: Engine correctly reports not ready before init');
            passed++;
        } else {
            console.log('✗ Test 1: Engine should not be ready before init');
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 1: Unexpected error:', e.message);
        failed++;
    }

    // Test 2: Invalid license key fails
    try {
        await initEngine('wrong-key');
        console.log('✗ Test 2: Invalid key should throw error');
        failed++;
    } catch (e) {
        if (e.message.includes('Invalid license')) {
            console.log('✓ Test 2: Invalid license key correctly rejected');
            passed++;
        } else {
            console.log('✗ Test 2: Unexpected error:', e.message);
            failed++;
        }
    }

    // Test 3: Dev key works
    try {
        await initEngine('dev');
        console.log('✓ Test 3: Dev key accepted');
        passed++;
    } catch (e) {
        console.log('✗ Test 3: Dev key failed:', e.message);
        failed++;
    }

    // Test 4: Engine ready after init
    try {
        const ready = await isReady();
        if (ready === true) {
            console.log('✓ Test 4: Engine ready after init');
            passed++;
        } else {
            console.log('✗ Test 4: Engine should be ready after init');
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 4: Unexpected error:', e.message);
        failed++;
    }

    // Test 5: Get tier
    try {
        const tier = await getTier();
        if (tier === 'registered') {
            console.log('✓ Test 5: Tier is "registered" for dev key');
            passed++;
        } else {
            console.log('✗ Test 5: Expected tier "registered", got:', tier);
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 5: Unexpected error:', e.message);
        failed++;
    }

    // Test 6: Get checks limit
    try {
        const limit = await getChecksLimit();
        if (limit === 100) {
            console.log('✓ Test 6: Checks limit is 100 for registered tier');
            passed++;
        } else {
            console.log('✗ Test 6: Expected limit 100, got:', limit);
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 6: Unexpected error:', e.message);
        failed++;
    }

    // Test 7: Run audit returns result
    try {
        const result = await runAudit('https://example.com/test', testHtml);
        if (result && typeof result.score === 'number' && Array.isArray(result.issues)) {
            console.log('✓ Test 7: Audit returns valid result');
            console.log(`  - Score: ${result.score}`);
            console.log(`  - Issues: ${result.issues.length}`);
            console.log(`  - Checks run: ${result.checksRun}`);
            passed++;
        } else {
            console.log('✗ Test 7: Invalid result structure');
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 7: Audit failed:', e.message);
        failed++;
    }

    // Test 8: Audit score is reasonable
    try {
        const result = await runAudit('https://example.com/test', testHtml);
        if (result.score >= 0 && result.score <= 100) {
            console.log('✓ Test 8: Score is in valid range (0-100)');
            passed++;
        } else {
            console.log('✗ Test 8: Score out of range:', result.score);
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 8: Unexpected error:', e.message);
        failed++;
    }

    // Test 9: Issues have required fields
    try {
        const result = await runAudit('https://example.com/test', testHtml);
        const issue = result.issues[0];
        if (issue && issue.code && issue.severity && issue.title) {
            console.log('✓ Test 9: Issues have required fields');
            console.log(`  - Sample: [${issue.severity}] ${issue.title}`);
            passed++;
        } else {
            console.log('✗ Test 9: Issues missing required fields');
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 9: Unexpected error:', e.message);
        failed++;
    }

    // Summary
    console.log('');
    console.log('='.repeat(50));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
    console.error('Test suite error:', e);
    process.exit(1);
});
