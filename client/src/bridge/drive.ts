// Google Drive API Bridge
// Scope: https://www.googleapis.com/auth/drive.file

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export async function initDriveApi(clientId: string, apiKey: string) {
  return new Promise((resolve) => {
    const script1 = document.createElement('script');
    script1.src = 'https://apis.google.com/js/api.js';
    script1.onload = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({
          apiKey: apiKey,
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        if (gisInited) resolve(true);
      });
    };
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://accounts.google.com/gsi/client';
    script2.onload = () => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: '', // defined at request time
      });
      gisInited = true;
      if (gapiInited) resolve(true);
    };
    document.head.appendChild(script2);
  });
}

export async function signIn() {
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
      }
      resolve(resp);
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export async function findRootFolder() {
  const response = await window.gapi.client.drive.files.list({
    q: "name = 'MoneySplitter' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id, name)',
  });
  const files = response.result.files;
  if (files && files.length > 0) {
    return files[0].id;
  }
  
  // Create if not exists
  const createResponse = await window.gapi.client.drive.files.create({
    resource: {
      name: 'MoneySplitter',
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });
  return createResponse.result.id;
}

export async function listGroups(rootFolderId: string) {
  const response = await window.gapi.client.drive.files.list({
    q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });
  return response.result.files || [];
}

export async function getGroupCsvs(groupId: string) {
  const response = await window.gapi.client.drive.files.list({
    q: `'${groupId}' in parents and mimeType = 'text/csv' and trashed = false`,
    fields: 'files(id, name)',
  });
  return response.result.files || [];
}

export async function downloadFile(fileId: string) {
  const response = await window.gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media',
  });
  return response.body;
}

export async function appendToCsv(fileId: string, content: string, existingContent: string) {
  const newContent = existingContent + (existingContent.endsWith('\n') ? '' : '\n') + content;
  await window.gapi.client.request({
    path: `/upload/drive/v3/files/${fileId}`,
    method: 'PATCH',
    params: { uploadType: 'media' },
    body: newContent,
  });
}
