import { render } from 'solid-js/web';
import { createSignal, onMount, For, Show, onCleanup, createEffect } from 'solid-js';

import hljs from 'highlight.js/lib/core';
import javascript_hljs from 'highlight.js/lib/languages/javascript';
import typescript_hljs from 'highlight.js/lib/languages/typescript';
import json_hljs from 'highlight.js/lib/languages/json';
import xml_hljs from 'highlight.js/lib/languages/xml';
import css_hljs from 'highlight.js/lib/languages/css';
import bash_hljs from 'highlight.js/lib/languages/bash';
import markdown_hljs from 'highlight.js/lib/languages/markdown';
import sql_hljs from 'highlight.js/lib/languages/sql';

import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, foldGutter, foldKeymap } from '@codemirror/language';
import { lintGutter } from "@codemirror/lint";
import { oneDark } from '@codemirror/theme-one-dark';

import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';

hljs.registerLanguage('javascript', javascript_hljs);
hljs.registerLanguage('typescript', typescript_hljs);
hljs.registerLanguage('json', json_hljs);
hljs.registerLanguage('html', xml_hljs);
hljs.registerLanguage('css', css_hljs);
hljs.registerLanguage('bash', bash_hljs);
hljs.registerLanguage('markdown', markdown_hljs);
hljs.registerLanguage('sql', sql_hljs);

function App() {
  const [loading, setLoading] = createSignal(true);
  const [status, setStatus] = createSignal('');
  const [userData, setUserData] = createSignal(null);
  const [files, setFiles] = createSignal([]);
  const [selectedFile, setSelectedFile] = createSignal(null);
  const [fileContent, setFileContent] = createSignal('');
  const [newFileName, setNewFileName] = createSignal('');
  const [newFolderName, setNewFolderName] = createSignal('');
  const [openFolders, setOpenFolders] = createSignal({});
  const [contextMenu, setContextMenu] = createSignal({
    visible: false,
    x: 0,
    y: 0,
    file: null,
  });
  const [isMobileView, setIsMobileView] = createSignal(false);
  const [isEditingFile, setIsEditingFile] = createSignal(true);
  const [initialLoadComplete, setInitialLoadComplete] = createSignal(false);

  const [renameContainerInfo, setRenameContainerInfo] = createSignal({
    visible: false,
    file: null,
    newName: '',
  });
  const [createItemModalInfo, setCreateItemModalInfo] = createSignal({
    visible: false,
    parentPath: null,
    isDir: false,
    itemName: '',
  });

  let renameInputRef;
  let codeRef;
  let createItemInputRef;
  let editorRef;
  let editorViewInstance = null;

  const languageCompartment = new Compartment();
  const themeCompartment = new Compartment();
  const editableCompartment = new Compartment();

  const linkManager = '/private/server/exocore/web/file';

  const getToken = () => localStorage.getItem('exocore-token') || '';
  const getCookies = () => localStorage.getItem('exocore-cookies') || '';

  function sortFileSystemItems(items) {
    if (!Array.isArray(items)) return [];

    const specialOrder = ['.git', 'package.json', 'package-lock.json'];
    const nodeModulesName = 'node_modules';

    const regularItems = items.filter(item => !specialOrder.includes(item.name) && item.name !== nodeModulesName);
    const specialItemsOnList = items.filter(item => specialOrder.includes(item.name));
    const nodeModulesItem = items.find(item => item.name === nodeModulesName);

    regularItems.sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
    });
    specialItemsOnList.sort((a, b) => specialOrder.indexOf(a.name) - specialOrder.indexOf(b.name));

    const sortedItems = [...regularItems, ...specialItemsOnList];
    if (nodeModulesItem) {
      sortedItems.push(nodeModulesItem);
    }
    return sortedItems;
  }

  async function fetchUserInfo() {
    setLoading(true);
    const token = getToken();
    const cookies = getCookies();

    if (!token || !cookies) {
      setLoading(false);
      setInitialLoadComplete(true);
      window.location.href = '/private/server/exocore/web/public/login';
      return;
    }

    try {
      const res = await fetch('/private/server/exocore/web/userinfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, cookies }),
      });

      if (!res.ok) {
        let errorMsg = `Server error: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMsg = errorData.message || errorMsg;
        } catch (parseError) {
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();

      if (data.data?.user && data.data.user.verified === 'success') {
        setUserData(data.data.user);
        setStatus('');
        await fetchFiles('');
      } else {
        setUserData(null);
        setStatus(data.message || 'User verification failed or user data incomplete. Redirecting to login...');
        localStorage.removeItem('exocore-token');
        localStorage.removeItem('exocore-cookies');
        setTimeout(() => {
          window.location.href = '/private/server/exocore/web/public/login';
        }, 2500);
      }
    } catch (err) {
      setUserData(null);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus('Failed to fetch user info: ' + errorMessage + '. Redirecting to login...');
      localStorage.removeItem('exocore-token');
      localStorage.removeItem('exocore-cookies');
      setTimeout(() => {
          window.location.href = '/private/server/exocore/web/public/login';
      }, 2500);
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }

  async function fetchFiles(currentPath = '') {
    setLoading(true);
    let endpoint = '';
    let bodyPayload = {};
    if (currentPath) {
      endpoint = `${linkManager}/open-folder`;
      bodyPayload = {
        folder: currentPath,
      };
    } else {
      endpoint = `${linkManager}/list`;
      bodyPayload = {};
    }
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });
      const responseText = await res.text();
      if (!res.ok) {
        let errorMsg = responseText;
        try {
          const errData = JSON.parse(responseText);
          errorMsg = errData.message || errData.error || responseText;
        } catch (e) {}
        throw new Error(errorMsg || `HTTP error! status: ${res.status}`);
      }
      const data = JSON.parse(responseText);
      if (currentPath) {
        if (data && Array.isArray(data.items)) {
          setOpenFolders((prev) => ({
            ...prev,
            [currentPath]: sortFileSystemItems(data.items),
          }));
        } else {
          setOpenFolders((prev) => ({
            ...prev,
            [currentPath]: [],
          }));
          setStatus(`Error: Could not load content for folder ${currentPath}. Invalid response.`);
        }
      } else {
        if (Array.isArray(data)) {
          setFiles(sortFileSystemItems(data));
        } else {
          setFiles([]);
          setStatus(`Error: Could not load root directory. Invalid response.`);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to list ${currentPath || 'root directory'}: ${errorMessage}`);
      if (currentPath) {
        setOpenFolders((prev) => ({
          ...prev,
          [currentPath]: undefined,
        }));
      }
    } finally {
      setLoading(false);
    }
  }

  async function openFile(file) {
    setLoading(true);
    try {
      const res = await fetch(`${linkManager}/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file,
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP error! status: ${res.status}`);
      setSelectedFile(file);
      setFileContent(text);
      setIsEditingFile(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus('Failed to open file: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function closeFileEditor() {
    setSelectedFile(null);
    setFileContent('');
  }

  async function saveFile() {
    if (!selectedFile()) return;
    setLoading(true);
    try {
      const res = await fetch(`${linkManager}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file: selectedFile(),
          content: fileContent(),
        }),
      });
      const message = await res.text();
      if (!res.ok) throw new Error(message || `HTTP error! status: ${res.status}`);
      setStatus(message);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus('Failed to save file: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function refreshFileSystem(affectedItemPath = '') {
    let parentPath = '';
    if (affectedItemPath) {
      const lastSlashIndex = affectedItemPath.lastIndexOf('/');
      if (lastSlashIndex !== -1) {
        parentPath = affectedItemPath.substring(0, lastSlashIndex);
      }
    }
    await fetchFiles();
    if (parentPath && openFolders()[parentPath]) {
      await fetchFiles(parentPath);
    }
  }

  function fileOrFolderNameIsDirectory(path) {
    if (openFolders()[path] !== undefined) return true;
    const checkList = (list, currentBuildPath = '') => {
      for (const item of list) {
        const itemFullPath = currentBuildPath ? `${currentBuildPath}/${item.name}` : item.name;
        if (itemFullPath === path) return item.isDir;
        if (item.isDir && openFolders()[itemFullPath]) {
          const foundInSub = checkList(openFolders()[itemFullPath], itemFullPath);
          if (foundInSub !== undefined) return foundInSub;
        }
      }
      return undefined;
    };
    return checkList(files()) || false;
  }

  async function createFile() {
    const name = newFileName().trim();
    if (!name) {
      setStatus('Please enter a file name.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${linkManager}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: name }),
      });
      const message = await res.text();
      if (!res.ok) throw new Error(message || `HTTP error! status: ${res.status}`);
      setNewFileName('');
      await refreshFileSystem(name);
      setStatus(`File "${name}" created successfully.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus('Failed to create file: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function createFolder() {
    const name = newFolderName().trim();
    if (!name) {
      setStatus('Please enter a folder name.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${linkManager}/create-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: name }),
      });
      const message = await res.text();
      if (!res.ok) throw new Error(message || `HTTP error! status: ${res.status}`);
      setNewFolderName('');
      await refreshFileSystem(name);
      setStatus(`Folder "${name}" created successfully.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus('Failed to create folder: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(e) {
    const fileToUpload = e.target.files[0];
    if (!fileToUpload) return;
    const targetPathForUpload = fileToUpload.name;
    const form = new FormData();
    form.append('file', fileToUpload);
    setLoading(true);
    try {
      const res = await fetch(`${linkManager}/upload`, {
        method: 'POST',
        body: form,
      });
      const message = await res.text();
      if (!res.ok) throw new Error(message || `HTTP error! status: ${res.status}`);
      await refreshFileSystem(targetPathForUpload);
      setStatus(`File "${fileToUpload.name}" uploaded successfully.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus('Failed to upload file: ' + errorMessage);
    } finally {
      setLoading(false);
      e.target.value = null;
    }
  }

  function download(file) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${linkManager}/download`;
    form.style.display = 'none';
    const input = document.createElement('input');
    input.name = 'file';
    input.value = file;
    input.type = 'hidden';
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
    setStatus(`Downloading "${file}"...`);
  }

  function toggleFolder(folderPath) {
    if (openFolders()[folderPath]) {
      setOpenFolders((prev) => {
        const updated = { ...prev };
        delete updated[folderPath];
        Object.keys(updated).forEach(key => {
          if (key.startsWith(folderPath + '/')) {
            delete updated[key];
          }
        });
        return updated;
      });
    } else {
      fetchFiles(folderPath);
    }
  }

  function handleFileClick(file, fullPath) {
    if (file.isDir) {
      toggleFolder(fullPath);
    } else {
      openFile(fullPath);
    }
  }

  function handleContextMenu(e, file, fullPath) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      file: { ...file, path: fullPath },
    });
  }

  function handleOpenFolderFromContextMenu() {
    const folderToOpen = contextMenu().file;
    if (folderToOpen && folderToOpen.isDir) {
      if (!openFolders()[folderToOpen.path]) {
        fetchFiles(folderToOpen.path);
      }
    }
    setContextMenu({ visible: false, x: 0, y: 0, file: null });
  }

  function handleDownloadSelected() {
    if (contextMenu().file && !contextMenu().file.isDir) {
      download(contextMenu().file.path);
    }
    setContextMenu({ visible: false, x: 0, y: 0, file: null });
  }

  async function handleUnzipSelected() {
    const fileToUnzip = contextMenu().file;
    if (!fileToUnzip || fileToUnzip.isDir || !fileToUnzip.name.toLowerCase().endsWith('.zip')) {
      setContextMenu({ visible: false, x: 0, y: 0, file: null });
      return;
    }

    const zipFilePath = fileToUnzip.path;
    setLoading(true);
    setContextMenu({ visible: false, x: 0, y: 0, file: null });

    try {
      const res = await fetch(`${linkManager}/unzip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipFilePath: zipFilePath,
          overwrite: true,
          destinationPath: '',
        }),
      });
      const message = await res.text();
      if (!res.ok) {
        let errorMsg = message;
        try {
          const errData = JSON.parse(message);
          errorMsg = errData.message || errData.error || message;
        } catch (e) { }
        throw new Error(errorMsg || `HTTP error! status: ${res.status}`);
      }
      setStatus(message);
      await refreshFileSystem(zipFilePath);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to unzip "${fileToUnzip.name}": ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  function handleRenameClick() {
    if (contextMenu().file) {
      setRenameContainerInfo({
        visible: true,
        file: contextMenu().file,
        newName: contextMenu().file.name,
      });
    }
    setContextMenu({ visible: false, x: 0, y: 0, file: null });
  }

  async function handleDeleteSelected() {
    const fileToDelete = contextMenu().file;
    if (!fileToDelete) return;

    const confirmation = window.confirm(`Are you sure you want to delete "${fileToDelete.name}"? This action cannot be undone.`);
    if (!confirmation) {
      setContextMenu({ visible: false, x: 0, y: 0, file: null });
      return;
    }

    setLoading(true);
    setContextMenu({ visible: false, x: 0, y: 0, file: null });

    try {
      const res = await fetch(`${linkManager}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fileToDelete.path }),
      });
      const message = await res.text();
      if (!res.ok) {
        let errorMsg = message;
        try {
          const errData = JSON.parse(message);
          errorMsg = errData.message || errData.error || message;
        } catch (e) { }
        throw new Error(errorMsg || `HTTP error! status: ${res.status}`);
      }
      setStatus(message || `Successfully deleted "${fileToDelete.name}".`);

      if (selectedFile() && selectedFile().startsWith(fileToDelete.path)) {
        closeFileEditor();
      }
      if (fileToDelete.isDir) {
        setOpenFolders((prev) => {
          const updated = { ...prev };
          delete updated[fileToDelete.path];
          Object.keys(updated).forEach(key => {
            if (key.startsWith(fileToDelete.path + '/')) {
              delete updated[key];
            }
          });
          return updated;
        });
      }
      await refreshFileSystem(fileToDelete.path);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to delete "${fileToDelete.name}": ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  function cancelRename() {
    setRenameContainerInfo({ visible: false, file: null, newName: '' });
  }

  async function performRename() {
    const fileToRename = renameContainerInfo().file;
    const newName = renameContainerInfo().newName.trim();

    if (!fileToRename || !newName) {
      setStatus('Invalid rename operation. New name cannot be empty.');
      cancelRename();
      return;
    }
    setLoading(true);
    try {
      const oldPath = fileToRename.path;
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;

      if (oldPath === newPath) {
        setStatus('No change detected. Renaming cancelled.');
        cancelRename();
        setLoading(false);
        return;
      }

      const res = await fetch(`${linkManager}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newPath }),
      });
      const message = await res.text();
      if (!res.ok) {
        let errorMsg = message;
        try {
          const errData = JSON.parse(message);
          errorMsg = errData.message || errData.error || message;
        } catch (e) { }
        throw new Error(errorMsg || `HTTP error! status: ${res.status}`);
      }
      setStatus(`Renamed "${fileToRename.name}" to "${newName}" successfully.`);

      if (fileToRename.isDir && openFolders()[oldPath]) {
        const contents = openFolders()[oldPath];
        setOpenFolders((prev) => {
          const updated = { ...prev };
          delete updated[oldPath];
          updated[newPath] = contents;
          Object.keys(updated).forEach(key => {
            if (key.startsWith(oldPath + '/')) {
              const subPath = key.substring(oldPath.length);
              const oldSubOpenFolderContent = updated[key];
              delete updated[key];
              updated[newPath + subPath] = oldSubOpenFolderContent;
            }
          });
          return updated;
        });
      }

      if (selectedFile() === oldPath) {
        setSelectedFile(newPath);
      }

      await refreshFileSystem(newPath);
      cancelRename();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus('Failed to rename: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function handleShowCreateItemModal(isDirContext) {
    const contextFile = contextMenu().file;
    let parentPathTarget = '';

    if (contextFile) {
        if (contextFile.isDir) {
            parentPathTarget = contextFile.path;
        } else {
            const lastSlash = contextFile.path.lastIndexOf('/');
            parentPathTarget = lastSlash === -1 ? '' : contextFile.path.substring(0, lastSlash);
        }
    }

    setCreateItemModalInfo({
        visible: true,
        parentPath: parentPathTarget,
        isDir: isDirContext,
        itemName: '',
    });
    setContextMenu({ visible: false, x: 0, y: 0, file: null });
}

  function cancelCreateItem() {
    setCreateItemModalInfo({ visible: false, parentPath: null, isDir: false, itemName: '' });
  }

  async function performCreateItem() {
    const { parentPath, itemName, isDir } = createItemModalInfo();
    const newItemNameTrimmed = itemName.trim();

    if (!newItemNameTrimmed) {
      setStatus(`Please enter a ${isDir ? 'folder' : 'file'} name.`);
      return;
    }
    const fullPath = parentPath ? `${parentPath}/${newItemNameTrimmed}` : newItemNameTrimmed;
    setLoading(true);
    try {
      const endpoint = isDir ? `${linkManager}/create-folder` : `${linkManager}/create`;
      const payload = isDir ? { folder: fullPath } : { file: fullPath };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const message = await res.text();
      if (!res.ok) {
        let errorMsg = message;
        try {
          const errData = JSON.parse(message);
          errorMsg = errData.message || errData.error || message;
        } catch (e) { }
        throw new Error(errorMsg || `HTTP error! status: ${res.status}`);
      }
      setStatus(`${isDir ? 'Folder' : 'File'} "${newItemNameTrimmed}" created successfully in "${parentPath || 'root'}".`);
      cancelCreateItem();
      await refreshFileSystem(fullPath);
      if (parentPath) {
         await fetchFiles(parentPath);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatus(`Failed to create ${isDir ? 'folder' : 'file'}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  function getFileIconPath(fileItem, isFolderOpen) {
    const baseIconPath = './icons/';
    const nameLower = fileItem.name.toLowerCase();
    if (fileItem.isDir) {
      if (nameLower === '.git') {
        return `${baseIconPath}git.svg`;
      }
      return isFolderOpen ? `${baseIconPath}folder-open.svg` : `${baseIconPath}folder.svg`;
    }
    if (nameLower === 'exocore.run') { return `${baseIconPath}exocore.run.svg`; }
    if (nameLower === '.gitignore' || nameLower === '.gitattributes' || nameLower === '.gitmodules') {
      return `${baseIconPath}git.svg`;
    }
    const parts = nameLower.split('.');
    let extension = '';
    if (parts.length > 1) {
      const potentialExtension = parts.pop();
      if (parts[0] !== '' || parts.length > 0) {
          if (potentialExtension !== undefined) {
            extension = potentialExtension;
          }
      } else if (potentialExtension !== undefined) {
          extension = potentialExtension;
      }
    }
    switch (extension) {
      case 'js': return `${baseIconPath}js.svg`;
      case 'jsx': return `${baseIconPath}jsx.svg`;
      case 'ts': return `${baseIconPath}ts.svg`;
      case 'tsx': return `${baseIconPath}tsx.svg`;
      case 'json': return `${baseIconPath}json.svg`;
      case 'xml': return `${baseIconPath}xml.svg`;
      case 'html': return `${baseIconPath}html.svg`;
      case 'css': return `${baseIconPath}css.svg`;
      case 'md': return `${baseIconPath}md.svg`;
      case 'sh': return `${baseIconPath}sh.svg`;
      case 'sql': return `${baseIconPath}sql.svg`;
      case 'zip': return `${baseIconPath}zip.svg`;
      case 'gif': return `${baseIconPath}gifImage.svg`;
      case 'jpg':
      case 'jpeg':
      case 'png':
        return `${baseIconPath}image.svg`;
      case 'mp4':
      case 'mov':
      case 'avi':
      case 'mkv':
      case 'webm':
      case 'flv':
      case 'wmv':
        return `${baseIconPath}video.svg`;
      case 'git':
        return `${baseIconPath}git.svg`;
      default:
        return `${baseIconPath}undefined.svg`;
    }
  }

  function renderFiles(list, parentPath = '') {
    return (
      <ul style={{ 'margin-left': '1rem', 'padding-left': '0', 'list-style-type': 'none' }}>
        <For each={list}>
          {(file) => {
            const fullPath = parentPath ? `${parentPath}/${file.name}` : file.name;
            const isDirOpen = file.isDir && openFolders()[fullPath];
            const iconPath = getFileIconPath(file, isDirOpen);
            let listItemRef;
            const baseItemStyle = {
              'user-select': 'none',
              padding: '0.2rem 0.1rem',
              'border-radius': theme.borderRadius,
              transition: 'background-color 0.2s',
              'margin-bottom': '2px',
            };

            return (
              <li
                ref={listItemRef}
                style={baseItemStyle}
                onMouseEnter={() => { if (listItemRef) listItemRef.style.backgroundColor = theme.itemHoverBg; }}
                onMouseLeave={() => { if (listItemRef) listItemRef.style.backgroundColor = 'transparent'; }}
                title={fullPath}
              >
                <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between' }}>
                  <div
                    onClick={() => handleFileClick(file, fullPath)}
                    style={{ flexGrow: 1, display: 'flex', 'align-items': 'center', cursor: 'pointer', padding: '0.3rem 0.2rem' }}
                  >
                    <img src={iconPath} alt={file.isDir ? 'Folder' : 'File'} style={{ width: '18px', height: '18px', 'margin-right': '0.75rem', 'flex-shrink': 0 }} />
                    <span style={{ color: theme.text, 'font-size': '1.05rem' }}>{file.name}</span>
                  </div>
                  <span
                    onClick={(e) => handleContextMenu(e, file, fullPath)}
                    style={{ cursor: 'pointer', 'font-weight': 'bold', padding: '0 0.5rem', color: theme.textMuted, 'font-size': '1.2rem' }}
                    onMouseEnter={(e) => e.target.style.color = theme.primary}
                    onMouseLeave={(e) => e.target.style.color = theme.textMuted}
                  > ⋮ </span>
                </div>
                <Show when={file.isDir && openFolders()[fullPath] && Array.isArray(openFolders()[fullPath]) && openFolders()[fullPath].length > 0}>
                  {renderFiles(openFolders()[fullPath], fullPath)}
                </Show>
                <Show when={file.isDir && openFolders()[fullPath] && Array.isArray(openFolders()[fullPath]) && openFolders()[fullPath].length === 0}>
                  <div style={{ 'margin-left': '2rem', padding: '0.3rem 0', color: theme.textMuted, 'font-style': 'italic', 'font-size': '0.9rem' }}>(empty folder)</div>
                </Show>
              </li>
            );
          }}
        </For>
      </ul>
    );
  }

  function handleDownloadAll() {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${linkManager}/download-zip`;
    form.style.display = 'none';
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
    setStatus('Downloading all files (root) as ZIP...');
  }

  const getCodeMirrorLanguageSupport = (filename) => {
    const extension = filename?.split('.').pop()?.toLowerCase();
    if (!extension) return javascript();
    switch (extension) {
      case 'js': case 'jsx': return javascript();
      case 'ts': case 'tsx': return javascript({typescript: true, jsx: true});
      case 'json': return json();
      case 'html': case 'htm': case 'xml': case 'svg': return html();
      case 'css': return css();
      case 'md': case 'markdown': return markdown();
      default: return javascript();
    }
  };

  onMount(() => {
    const patrickHandFontLink = document.createElement('link');
    patrickHandFontLink.href = 'https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap';
    patrickHandFontLink.rel = 'stylesheet';
    document.head.appendChild(patrickHandFontLink);

    const firaCodeFontLink = document.createElement('link');
    firaCodeFontLink.href = 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap';
    firaCodeFontLink.rel = 'stylesheet';
    document.head.appendChild(firaCodeFontLink);

    const hljsThemeLink = document.createElement('link');
    hljsThemeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css';
    hljsThemeLink.rel = 'stylesheet';
    document.head.appendChild(hljsThemeLink);

    const appElement = document.getElementById('app');
    if (appElement) {
        appElement.style.fontFamily = theme.fontFamily;
        appElement.style.minHeight = '100vh';
    }

    fetchUserInfo();

    const handleClickOutside = (e) => {
      const contextMenuElement = document.getElementById('context-menu');
      const createItemModalOverlayElement = document.querySelector('.create-item-modal-overlay');
      const renameModalOverlayElement = document.querySelector('.rename-modal-overlay');

      if (contextMenu().visible && contextMenuElement && !contextMenuElement.contains(e.target)) {
        setContextMenu({ visible: false, x: 0, y: 0, file: null });
      }
      if (createItemModalInfo().visible && createItemModalOverlayElement && e.target === createItemModalOverlayElement) {
        cancelCreateItem();
      }
      if (renameContainerInfo().visible && renameModalOverlayElement && e.target === renameModalOverlayElement) {
        cancelRename();
      }
    };
    document.addEventListener('click', handleClickOutside);

    const checkMobile = () => setIsMobileView(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    onCleanup(() => {
      window.removeEventListener('resize', checkMobile);
      document.removeEventListener('click', handleClickOutside);
      if (editorViewInstance) {
        editorViewInstance.destroy();
        editorViewInstance = null;
      }
    });
  });

  createEffect(() => {
    const currentFile = selectedFile();
    const editing = isEditingFile();
    const content = fileContent();

    if (editorRef && editing && currentFile) {
      const cmLanguageSupport = getCodeMirrorLanguageSupport(currentFile);
      if (editorViewInstance) {
        if (editorViewInstance.state.doc.toString() !== content) {
            editorViewInstance.dispatch({
                changes: { from: 0, to: editorViewInstance.state.doc.length, insert: content || '' }
            });
        }
        editorViewInstance.dispatch({
          effects: [
            languageCompartment.reconfigure(cmLanguageSupport),
            editableCompartment.reconfigure(EditorView.editable.of(true)),
          ]
        });
      } else {
        const state = EditorState.create({
          doc: content || '',
          extensions: [
            EditorView.lineWrapping,
            history(),
            keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
            lineNumbers(),
            foldGutter(),
            lintGutter(),
            editableCompartment.of(EditorView.editable.of(true)),
            languageCompartment.of(cmLanguageSupport),
            themeCompartment.of(oneDark),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            EditorView.theme({
                '&': { fontSize: '12px' },
                '.cm-content': { fontFamily: theme.monospaceFontFamily },
                '.cm-gutters': { fontSize: '13px', backgroundColor: '#282c34' },
                '.cm-lineNumbers .cm-gutterElement': { padding: '0 3px 0 5px', minWidth: '20px', textAlign: 'right' }
            }),
            EditorView.updateListener.of(update => {
              if (update.docChanged) {
                if (update.transactions.some(tr => tr.isUserEvent('input') || tr.isUserEvent('delete'))) {
                    setFileContent(update.state.doc.toString());
                }
              }
            })
          ]
        });
        editorViewInstance = new EditorView({ state, parent: editorRef });
      }
    } else if (editorViewInstance) {
      editorViewInstance.destroy();
      editorViewInstance = null;
    }
  });

  let hasFocusedRenameInput = false;
  createEffect(() => {
    if (renameContainerInfo().visible && renameInputRef && !hasFocusedRenameInput) {
      setTimeout(() => {
        if (renameInputRef) {
          renameInputRef.focus();
          renameInputRef.select();
        }
        hasFocusedRenameInput = true;
      }, 50);
    } else if (!renameContainerInfo().visible) {
      hasFocusedRenameInput = false;
    }
  });

  let hasFocusedCreateItemInput = false;
  createEffect(() => {
    if (createItemModalInfo().visible && createItemInputRef && !hasFocusedCreateItemInput) {
      setTimeout(() => {
        if (createItemInputRef) {
           createItemInputRef.focus();
        }
        hasFocusedCreateItemInput = true;
      }, 50);
    } else if (!createItemModalInfo().visible) {
      hasFocusedCreateItemInput = false;
    }
  });

  const theme = {
    bg: '#0F172A',
    panelBg: '#1E293B',
    border: '#334155',
    text: '#E2E8F0',
    textMuted: '#94A3B8',
    primary: '#38BDF8',
    primaryHover: '#0EA5E9',
    primaryText: '#0F172A',
    secondary: '#FACC15',
    secondaryHover: '#EAB308',
    secondaryText: '#1E293B',
    destructive: '#F43F5E',
    destructiveHover: '#E11D48',
    destructiveText: '#E2E8F0',
    inputBg: '#0A0F1A',
    inputBorder: '#334155',
    inputFocusBorder: '#38BDF8',
    fontFamily: "'Patrick Hand', cursive",
    monospaceFontFamily: "'Fira Code', 'Source Code Pro', monospace",
    borderRadius: '6px',
    itemHoverBg: 'rgba(51, 65, 85, 0.7)',
    shadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
    itemSelectedBg: '#38BDF8',
  };

  const baseButtonStyle = {
    padding: '0.6rem 1.2rem',
    'font-size': '1.1rem',
    border: 'none',
    'border-radius': theme.borderRadius,
    cursor: 'pointer',
    'font-family': theme.fontFamily,
    'letter-spacing': '0.5px',
    transition: 'background-color 0.2s, transform 0.1s',
    'margin-right': '0.5rem',
    'line-height': '1.4',
  };

  const createButtonStyler = (baseColor, hoverColor, textColor) => {
    let btnRef;
    return {
      ref: el => btnRef = el,
      style: { ...baseButtonStyle, background: baseColor, color: textColor },
      onMouseEnter: () => btnRef && (btnRef.style.backgroundColor = hoverColor),
      onMouseLeave: () => btnRef && (btnRef.style.backgroundColor = baseColor),
    };
  };

  const primaryButtonProps = (text, onClick) => {
    const { ref, style, onMouseEnter, onMouseLeave } = createButtonStyler(theme.primary, theme.primaryHover, theme.primaryText);
    return <button ref={ref} style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>{text}</button>;
  };

  const secondaryButtonProps = (text, onClick) => {
    const { ref, style, onMouseEnter, onMouseLeave } = createButtonStyler(theme.secondary, theme.secondaryHover, theme.secondaryText);
    return <button ref={ref} style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>{text}</button>;
  };

  const destructiveButtonProps = (text, onClick) => {
    const { ref, style, onMouseEnter, onMouseLeave } = createButtonStyler(theme.destructive, theme.destructiveHover, theme.destructiveText);
    return <button ref={ref} style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>{text}</button>;
  };

  const defaultButtonProps = (text, onClick, additionalStyles = {}) => {
    const { ref, style, onMouseEnter, onMouseLeave } = createButtonStyler(theme.panelBg, theme.border, theme.textMuted);
    return <button ref={ref} style={{...style, border: `1px solid ${theme.border}`, ...additionalStyles}} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>{text}</button>;
  };

  const iconButtonStyler = (baseColor, hoverColor, textColor) => {
    let btnRef;
    const iconBaseStyle = { ...baseButtonStyle, padding: '0.5rem 0.7rem', 'font-size': '1.5rem', 'line-height': '1', 'margin-right': '0' };
    return {
      ref: el => btnRef = el,
      style: { ...iconBaseStyle, background: baseColor, color: textColor, border: `1px solid ${theme.border}`},
      onMouseEnter: () => btnRef && (btnRef.style.backgroundColor = hoverColor),
      onMouseLeave: () => btnRef && (btnRef.style.backgroundColor = baseColor),
    };
  };

  const inputStyle = {
    padding: '0.7rem 0.9rem',
    'font-size': '1.05rem',
    border: `1px solid ${theme.inputBorder}`,
    'border-radius': theme.borderRadius,
    flex: '1',
    'margin-right': '0.5rem',
    'font-family': theme.fontFamily,
    'background-color': theme.inputBg,
    color: theme.text,
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    'letter-spacing': '0.5px',
  };

  const modalInputStyle = {
      ...inputStyle,
      width: 'calc(100% - 22px)',
      'margin-bottom': '20px',
      'margin-right': '0',
      'font-size': '1.1rem',
  };

  const codeViewerBaseStyle = {
      width: '100%',
      fontFamily: theme.monospaceFontFamily,
      border: `1px solid ${theme.border}`,
      padding: '15px',
      boxSizing: 'border-box',
      flex: '1',
      marginBottom: '15px',
      minHeight: isMobileView() ? '250px' : '350px',
      resize: 'vertical',
      overflow: 'auto',
      backgroundColor: '#282c34',
      color: theme.text,
      borderRadius: theme.borderRadius,
      fontSize: '12px',
  };

  const codeMirrorEditorStyle = {
      ...codeViewerBaseStyle,
      padding: '0px',
  };

  return (
    <div style={{ 'font-size': '1.1rem', background: theme.bg, color: theme.text, 'min-height': '100vh', padding: '25px', 'box-sizing': 'border-box' }}>
      <h2 style={{ color: theme.primary, 'font-size': '2.8rem', 'margin-bottom': '25px', 'text-align': 'center', 'letter-spacing': '1px' }}>
        📁 ExoCore Explorer 📂
      </h2>

      <Show when={status()}>
        <div class="status-box" style={{ 'background-color': theme.panelBg, border: `1px solid ${theme.border}`, color: theme.text, padding: '12px 18px', 'margin-bottom': '1.5rem', 'border-radius': theme.borderRadius, display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', 'box-shadow': '0 2px 5px rgba(0,0,0,0.2)', 'font-size': '1.05rem' }}>
          {status()}
          {defaultButtonProps('Clear', () => setStatus(''), { padding: '0.2rem 0.5rem', 'margin-left': '10px', 'font-size': '0.9rem' })}
        </div>
      </Show>

      <Show when={loading() && !(isMobileView() && selectedFile())}>
         <div style={{ 'margin-top': '1.5rem', color: theme.textMuted, 'font-size': '1.2rem', 'text-align': 'center' }}>Loading... ⏳ Please wait...</div>
      </Show>

      <div class="main-content-flex" style={{ display: 'flex', 'margin-top': '1.5rem', gap: '25px', 'flex-wrap': (isMobileView() && selectedFile()) ? 'wrap' : 'nowrap' }}>
        <div class="file-list-panel" style={{ ...(isMobileView() && selectedFile() ? {display: 'none'} : {flex: '1'}), border: `1px solid ${theme.border}`, padding: '20px', background: theme.panelBg, 'min-width': '320px', color: theme.text, 'border-radius': theme.borderRadius, 'box-shadow': theme.shadow }}>
          <h4 style={{ color: theme.primary, 'font-size': '1.5rem', 'margin-top': '0', 'margin-bottom': '1rem', 'border-bottom': `1px solid ${theme.border}`, 'padding-bottom': '0.5rem' }}>Controls</h4>
          <div style={{ 'margin-bottom': '0.8rem', display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
            <input style={inputStyle} placeholder="New file name..." value={newFileName()} onInput={e => setNewFileName(e.target.value)} onKeyPress={e => e.key === 'Enter' && createFile()} onFocus={e => e.target.style.borderColor = theme.inputFocusBorder} onBlur={e => e.target.style.borderColor = theme.inputBorder} />
            {(() => {
                const { ref, style, onMouseEnter, onMouseLeave } = iconButtonStyler(theme.panelBg, theme.border, theme.primary);
                return <button ref={ref} style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={createFile} title="Create File">📄</button>;
            })()}
          </div>
          <div style={{ 'margin-bottom': '0.8rem', display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
            <input style={inputStyle} placeholder="New folder name..." value={newFolderName()} onInput={e => setNewFolderName(e.target.value)} onKeyPress={e => e.key === 'Enter' && createFolder()} onFocus={e => e.target.style.borderColor = theme.inputFocusBorder} onBlur={e => e.target.style.borderColor = theme.inputBorder} />
            {(() => {
                const { ref, style, onMouseEnter, onMouseLeave } = iconButtonStyler(theme.panelBg, theme.border, theme.primary);
                return <button ref={ref} style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={createFolder} title="Create Folder">📁</button>;
            })()}
          </div>
          <div style={{ 'margin-bottom': '1.5rem' }}>
            {(() => {
              const { ref, style, onMouseEnter, onMouseLeave } = createButtonStyler(theme.primary, theme.primaryHover, theme.primaryText);
              return <label for="fileUpload" ref={ref} style={{...style, display: 'inline-block', width: '100%', 'box-sizing': 'border-box', 'text-align': 'center', 'margin-right': 0}} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>📤 Upload File</label>;
            })()}
            <input id="fileUpload" type="file" onChange={uploadFile} style={{display: 'none'}} />
          </div>

          <h4 style={{ color: theme.primary, 'font-size': '1.5rem', 'margin-bottom': '1rem', 'border-bottom': `1px solid ${theme.border}`, 'padding-bottom': '0.5rem' }}>File System</h4>
          <div style={{ 'max-height': '450px', 'overflow-y': 'auto', border: `1px solid ${theme.border}`, padding: '10px', 'border-radius': theme.borderRadius, background: theme.inputBg }}>
            {renderFiles(files())}
          </div>
          <div style={{'margin-top': '1.5rem'}}>
            {secondaryButtonProps('Download All (Root) as ZIP 📦', handleDownloadAll)}
          </div>
        </div>

        <div class="file-editor-panel" style={ isMobileView() && selectedFile() ? { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.9)', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'z-index': '1001', padding: '15px', 'box-sizing': 'border-box' } : { flex: '3.5', 'min-width': '0', display: selectedFile() ? 'flex' : 'block', 'flex-direction': 'column' } }>
          <Show when={selectedFile()} fallback={ !isMobileView() || (isMobileView() && !selectedFile()) ? <div style={{ border: `2px dashed ${theme.border}`, padding: '30px', 'text-align': 'center', background: theme.panelBg, color: theme.textMuted, height: '100%', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'border-radius': theme.borderRadius, 'font-size': '1.3rem', 'box-shadow': theme.shadow }}>Select a file to embark on an editing adventure! 🚀</div> : null }>
            <div style={ isMobileView() ? { background: theme.panelBg, padding: '20px', 'border-radius': theme.borderRadius, 'box-shadow': theme.shadow, width: '100%', height: 'auto', 'max-height': 'calc(100vh - 40px)', display: 'flex', 'flex-direction': 'column', 'overflow-y': 'auto', color: theme.text, border: `1px solid ${theme.border}` } : { border: `1px solid ${theme.border}`, padding: '20px', background: theme.panelBg, height: '100%', display: 'flex', 'flex-direction': 'column', color: theme.text, 'border-radius': theme.borderRadius, 'box-shadow': theme.shadow } }>
              <h3 style={{ 'margin-top': '0', color: theme.primary, 'font-size': '1.6rem', 'margin-bottom': '1rem', 'word-break': 'break-all' }}>
                Now Editing: {selectedFile()}
              </h3>
              <div ref={el => editorRef = el} style={codeMirrorEditorStyle}></div>
              <div style={{ 'text-align': 'right', 'margin-top': '10px', display: 'flex', 'justify-content': 'flex-end', gap: '0.5rem' }}>
                  {primaryButtonProps('💾 Save', saveFile)}
                  {destructiveButtonProps('❌ Close', closeFileEditor)}
              </div>
            </div>
          </Show>
        </div>
      </div>

      <Show when={contextMenu().visible}>
        <div id="context-menu" style={{ position: 'fixed', top: `${contextMenu().y}px`, left: `${contextMenu().x}px`, background: theme.panelBg, border: `1px solid ${theme.border}`, padding: '0.4rem', 'z-index': '1000', 'box-shadow': '0 5px 15px rgba(0,0,0,0.5)', 'min-width': '170px', 'text-align': 'left', color: theme.text, 'border-radius': theme.borderRadius, transform: contextMenu().x > (window.innerWidth - 200) ? 'translateX(-100%)' : 'none' }}>
          {[
            { label: '✏️ Rename', action: handleRenameClick, show: () => true },
            { label: '📂 Open', action: handleOpenFolderFromContextMenu, show: () => contextMenu().file?.isDir },
            { label: '➕📄 Add New File', action: () => handleShowCreateItemModal(false), show: () => contextMenu().file?.isDir || !contextMenu().file },
            { label: '➕📁 Add New Folder', action: () => handleShowCreateItemModal(true), show: () => contextMenu().file?.isDir || !contextMenu().file },
            { label: '⬇️ Download', action: handleDownloadSelected, show: () => contextMenu().file && !contextMenu().file.isDir },
            {
              label: '🌀 Unzip Here',
              action: handleUnzipSelected,
              show: () => {
                const file = contextMenu().file;
                return file && !file.isDir && file.name.toLowerCase().endsWith('.zip');
              }
            },
            { label: '🗑️ Delete', action: handleDeleteSelected, show: () => contextMenu().file, color: theme.destructive },
          ].map(item => (
            <Show when={item.show()}>
              <div
                style={{ cursor: 'pointer', padding: '0.5rem 0.7rem', 'white-space': 'nowrap', color: item.color || theme.text, 'border-radius': '4px', transition: 'background-color 0.15s', 'font-size': '0.9rem' }}
                onClick={item.action}
                onMouseEnter={e => e.target.style.backgroundColor = theme.itemHoverBg}
                onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
              >
                {item.label}
              </div>
            </Show>
          ))}
          <Show when={contextMenu().file}>
            <div style={{ 'font-size': '0.8em', color: theme.textMuted, 'margin-top': '6px', 'border-top': `1px solid ${theme.border}`, 'padding-top': '6px' }}>
                {contextMenu().file.name} ({contextMenu().file.isDir ? 'Folder' : 'File'})
            </div>
          </Show>
        </div>
      </Show>

      <Show when={renameContainerInfo().visible}>
        <div class="rename-modal-overlay" style={{ position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.85)', display: 'flex', 'justify-content': 'center', 'align-items': 'center', 'z-index': '1002' }}>
          <div class="rename-modal-content" style={{ background: theme.panelBg, padding: '25px', 'border-radius': theme.borderRadius, 'box-shadow': theme.shadow, 'text-align': 'center', 'min-width': '320px', 'max-width': '90%', 'box-sizing': 'border-box', position: 'relative', color: theme.text, border: `1px solid ${theme.border}` }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: theme.primary, 'margin-top': 0, 'margin-bottom': '20px', 'font-size': '1.5rem' }}>Rename "{renameContainerInfo().file?.name}"</h3>
            <input ref={el => renameInputRef = el} style={modalInputStyle} value={renameContainerInfo().newName} onInput={e => setRenameContainerInfo(prev => ({ ...prev, newName: e.target.value }))} onKeyPress={e => e.key === 'Enter' && performRename()} onFocus={e => e.target.style.borderColor = theme.inputFocusBorder} onBlur={e => e.target.style.borderColor = theme.inputBorder} />
            <div style={{ display: 'flex', 'justify-content': 'center', gap: '10px', 'margin-top': '10px' }}>
              {primaryButtonProps('✔️ Confirm', performRename)}
              {destructiveButtonProps('✖️ Cancel', cancelRename)}
            </div>
          </div>
        </div>
      </Show>

      <Show when={createItemModalInfo().visible}>
        <div class="create-item-modal-overlay" style={{ position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.85)', display: 'flex', 'justify-content': 'center', 'align-items': 'center', 'z-index': '1002' }}>
          <div class="create-item-modal-content" style={{ background: theme.panelBg, padding: '25px', 'border-radius': theme.borderRadius, 'box-shadow': theme.shadow, 'text-align': 'center', 'min-width': '360px', 'max-width': '90%', 'box-sizing': 'border-box', position: 'relative', color: theme.text, border: `1px solid ${theme.border}` }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: theme.primary, 'margin-top': 0, 'margin-bottom': '20px', 'font-size': '1.4rem' }}> Create New {createItemModalInfo().isDir ? 'Folder' : 'File'} in "{createItemModalInfo().parentPath || 'root'}" </h3>
            <input ref={el => createItemInputRef = el} style={modalInputStyle} placeholder={createItemModalInfo().isDir ? 'New folder name...' : 'New file name (e.g., script.js)'} value={createItemModalInfo().itemName} onInput={e => setCreateItemModalInfo(prev => ({ ...prev, itemName: e.target.value }))} onKeyPress={e => e.key === 'Enter' && performCreateItem()} onFocus={e => e.target.style.borderColor = theme.inputFocusBorder} onBlur={e => e.target.style.borderColor = theme.inputBorder} />
            <div style={{ display: 'flex', 'justify-content': 'center', gap: '10px', 'margin-top': '10px' }}>
              {primaryButtonProps('✔️ Create', performCreateItem)}
              {destructiveButtonProps('✖️ Cancel', cancelCreateItem)}
            </div>
          </div>
        </div>
      </Show>

    </div>
  );
}

render(() => <App />, document.getElementById('app'));