import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob';

const CONTAINER = process.env.AZURE_STORAGE_CONTAINER ?? 'priovex-reports';

function getCredential(): StorageSharedKeyCredential {
  const account = process.env.AZURE_STORAGE_ACCOUNT;
  const key = process.env.AZURE_STORAGE_KEY;
  if (!account || !key) throw new Error('AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY are required');
  return new StorageSharedKeyCredential(account, key);
}

function getBlobServiceClient(): BlobServiceClient {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connStr) return BlobServiceClient.fromConnectionString(connStr);
  const cred = getCredential();
  return new BlobServiceClient(
    `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
    cred
  );
}

export async function uploadReport(
  searchId: string,
  filename: string,
  content: Buffer,
  contentType: string
): Promise<string> {
  const blobName = `reports/${searchId}/${filename}`;
  const blockBlobClient = getBlobServiceClient()
    .getContainerClient(CONTAINER)
    .getBlockBlobClient(blobName);

  await blockBlobClient.upload(content, content.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  // Container must have blob-level public access for this URL to be directly accessible
  return blockBlobClient.url;
}

export async function getSignedUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const credential = getCredential();
  const blockBlobClient = getBlobServiceClient()
    .getContainerClient(CONTAINER)
    .getBlockBlobClient(path);

  const sas = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER,
      blobName: path,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn: new Date(Date.now() + expiresInSeconds * 1000),
    },
    credential
  ).toString();

  return `${blockBlobClient.url}?${sas}`;
}

export async function deleteReport(searchId: string): Promise<void> {
  const containerClient = getBlobServiceClient().getContainerClient(CONTAINER);
  const prefix = `reports/${searchId}/`;
  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    await containerClient.deleteBlob(blob.name);
  }
}
