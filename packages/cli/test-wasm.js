#!/usr/bin/env node
/**
 * WASM Integration Test
 *
 * Tests that the WASM-protected audit engine works correctly.
 * Run from packages/cli: node test-wasm.js
 */

const { initEngine, getPremiumChecks, getVersion, isReady } = require('./dist/wasm-engine.js');

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

    // Test 5: Get engine version
    try {
        const version = await getVersion();
        if (typeof version === 'string' && version.length > 0) {
            console.log('✓ Test 5: Engine reports a version string:', version);
            passed++;
        } else {
            console.log('✗ Test 5: Expected a non-empty version string, got:', version);
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 5: Unexpected error:', e.message);
        failed++;
    }

    // Test 6: Get premium checks returns the expected named functions
    let premiumChecks;
    try {
        premiumChecks = await getPremiumChecks();
        const names = Object.keys(premiumChecks);
        if (names.length > 0 && names.every((name) => typeof premiumChecks[name] === 'function')) {
            console.log(`✓ Test 6: getPremiumChecks returns ${names.length} check functions`);
            passed++;
        } else {
            console.log('✗ Test 6: Expected a non-empty map of check functions, got:', names);
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 6: Unexpected error:', e.message);
        failed++;
    }

    // Test 7: A premium check runs and returns { issues, data }
    let checkResult;
    try {
        checkResult = premiumChecks.analyzeFeaturedSnippet(testHtml, 'https://example.com/test');
        if (checkResult && Array.isArray(checkResult.issues) && 'data' in checkResult) {
            console.log('✓ Test 7: Premium check returns valid { issues, data } result');
            console.log(`  - Issues: ${checkResult.issues.length}`);
            passed++;
        } else {
            console.log('✗ Test 7: Invalid result structure:', checkResult);
            failed++;
        }
    } catch (e) {
        console.log('✗ Test 7: Premium check failed:', e.message);
        failed++;
    }

    // Test 8: Every premium check runs without throwing
    try {
        const names = Object.keys(premiumChecks);
        for (const name of names) {
            const result = premiumChecks[name](testHtml, 'https://example.com/test');
            if (!result || !Array.isArray(result.issues)) {
                throw new Error(`${name} did not return { issues: [] }`);
            }
        }
        console.log(`✓ Test 8: All ${names.length} premium checks ran without throwing`);
        passed++;
    } catch (e) {
        console.log('✗ Test 8: Unexpected error:', e.message);
        failed++;
    }

    // Test 9: Issues (when present) have required fields
    try {
        const names = Object.keys(premiumChecks);
        const allIssues = names.flatMap((name) => premiumChecks[name](testHtml, 'https://example.com/test').issues);
        const issue = allIssues[0];
        if (!issue || (issue.code && issue.severity && issue.title)) {
            console.log('✓ Test 9: Issues have required fields');
            if (issue) console.log(`  - Sample: [${issue.severity}] ${issue.title}`);
            passed++;
        } else {
            console.log('✗ Test 9: Issues missing required fields:', issue);
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
