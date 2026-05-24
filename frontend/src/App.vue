<template>
  <div id="app">
    <h1>File Upload & Download</h1>
    
    <div class="upload-section">
      <h2>Upload File</h2>
      <input type="file" @change="handleFileUpload" ref="fileInput">
      <button @click="uploadFile">Upload</button>
      <p v-if="uploadStatus" :class="{ 'success': uploadSuccess, 'error': !uploadSuccess }">
        {{ uploadStatus }}
      </p>
    </div>
    
    <div class="download-section">
      <h2>Download File</h2>
      <div v-if="files.length === 0">No files uploaded yet</div>
      <div v-else>
        <ul>
          <li v-for="(file, index) in files" :key="index">
            {{ file.name }}
            <button @click="downloadFile(file.name)">Download</button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'App',
  data() {
    return {
      uploadedFile: null,
      uploadStatus: '',
      uploadSuccess: false,
      files: [],
      apiUrl: 'http://localhost:8080/api/files'
    }
  },
  created() {
    this.listFiles();
  },
  methods: {
    handleFileUpload(event) {
      this.uploadedFile = event.target.files[0];
    },
    async uploadFile() {
      if (!this.uploadedFile) {
        this.uploadStatus = 'Please select a file first';
        this.uploadSuccess = false;
        return;
      }
      
      const formData = new FormData();
      formData.append('file', this.uploadedFile);
      
      try {
        const response = await axios.post(`${this.apiUrl}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        this.uploadStatus = response.data;
        this.uploadSuccess = true;
        this.listFiles();
      } catch (error) {
        this.uploadStatus = 'Upload failed: ' + error.message;
        this.uploadSuccess = false;
      }
    },
    async listFiles() {
      try {
        const response = await axios.get(`${this.apiUrl}/list`);
        this.files = response.data.split('\n').filter(f => f.trim());
      } catch (error) {
        console.error('Error listing files:', error);
      }
    },
    async downloadFile(filename) {
      try {
        const response = await axios.get(`${this.apiUrl}/download/${filename}`, {
          responseType: 'blob'
        });
        
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (error) {
        console.error('Download failed:', error);
      }
    }
  }
}
</script>

<style>
#app {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

h1 {
  text-align: center;
  color: #333;
}

h2 {
  color: #555;
  border-bottom: 2px solid #eee;
  padding-bottom: 10px;
}

.upload-section, .download-section {
  margin: 30px 0;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

input[type="file"] {
  margin: 10px 0;
  padding: 8px;
}

button {
  background-color: #42b983;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

button:hover {
  background-color: #3aa876;
}

p {
  margin-top: 15px;
  font-weight: bold;
}

.success {
  color: green;
}

.error {
  color: red;
}

ul {
  list-style-type: none;
  padding: 0;
}

li {
  background-color: #f9f9f9;
  margin: 5px 0;
  padding: 10px;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

li button {
  background-color: #4a90e2;
  margin-top: 0;
}

li button:hover {
  background-color: #357abd;
}
</style>