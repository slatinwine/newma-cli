import { scanDirectory } from './src/scanner';

async function test() {
  console.log('Testing scanDirectory...');
  const projectRoot = '/Users/mac/kode';
  console.log('projectRoot:', projectRoot);

  try {
    const result = await scanDirectory(projectRoot, {
      listOnly: true,
      maxFiles: 3,
    });
    console.log('Success! Keys:', Object.keys(result).length);
    console.log('First 3 keys:', Object.keys(result).slice(0, 3));
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

test();
