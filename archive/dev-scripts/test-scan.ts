import { scanDirectory } from './src/scanner';

async function testScan() {
  console.log('Testing scanDirectory with listOnly=false, maxFiles=5...');

  try {
    const start = Date.now();
    const result = await scanDirectory('/Users/mac/kode', {
      listOnly: false,
      maxFiles: 5
    });
    const duration = Date.now() - start;

    console.log(`\n✅ Scan completed in ${duration}ms`);
    console.log('\nProject info:', JSON.stringify(result, null, 2).substring(0, 500) + '...');
  } catch (error: any) {
    console.error('\n❌ Scan failed:', error.message);
    console.error(error.stack);
  }
}

testScan();
