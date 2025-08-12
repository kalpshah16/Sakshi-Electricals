/* script.js
 - Hidden print template is filled and used for PDF generation
 - Row add/remove, per-row SGST/CGST, subtotal, totals, grand total
 - Amount in words (Indian)
 - Save invoice data to localStorage and show in dashboard
 - Replace header logo via Change Logo input
*/

// shorthand
const $ = id => document.getElementById(id);

// DOM refs
const itemsBody = $('itemsBody');
const btnAddRow = $('btnAddRow');
const btnClearRows = $('btnClearRows');
const btnGenerate = $('btnGenerate');
const btnSave = $('btnSave');
const btnSaveDraft = $('btnSaveDraft');
const tabInvoice = $('tabInvoice');
const tabDashboard = $('tabDashboard');
const invoiceSection = $('invoiceSection');
const dashboardSection = $('dashboardSection');
const invoicesList = $('invoicesList');
const logoFile = $('logoFile');
const companyLogo = $('companyLogo');
const printLogo = $('printLogo');
const btnClearHistory = $('btnClearHistory');

const LS_INVOICES = 'sakshi_invoices_v2';
const LS_DRAFT = 'sakshi_invoice_draft_v2';

// initialize
function init(){
  btnAddRow.addEventListener('click', ()=> addRow());
  btnClearRows.addEventListener('click', ()=> { if(confirm('Clear all rows?')){ itemsBody.innerHTML=''; addRow(); recalc(); }});
  btnGenerate.addEventListener('click', ()=> generateAndDownload());
  btnSave.addEventListener('click', saveInvoiceToHistory);
  btnSaveDraft.addEventListener('click', saveDraft);
  tabInvoice.addEventListener('click', ()=> showTab('invoice'));
  tabDashboard.addEventListener('click', ()=> showTab('dashboard'));
  logoFile.addEventListener('change', handleLogoUpload);
  btnClearHistory.addEventListener('click', ()=> { if(confirm('Delete all saved invoices?')){ localStorage.removeItem(LS_INVOICES); renderHistory(); }});

  // default rows
  addRow(); addRow(); addRow();

  loadDraft();
  renderHistory();
  recalc();
}

// add row
function addRow(data={}){
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="cell desc" value="${escapeHtml(data.description||'')}" placeholder="Description"></td>
    <td><input class="cell hsn" value="${escapeHtml(data.hsn||'')}" placeholder="HSN"></td>
    <td><input class="cell unit" value="${escapeHtml(data.unit||'')}" placeholder="Unit"></td>
    <td><input class="cell qty" type="number" min="0" value="${data.qty!==undefined?data.qty:1}"></td>
    <td><input class="cell rate" type="number" min="0" value="${data.rate!==undefined?data.rate:0}"></td>
    <td><input class="cell sgstPct" value="${data.sgstPct?String(data.sgstPct).replace('%',''):''}" placeholder="e.g. 9"></td>
    <td class="sgstAmt">₹0.00</td>
    <td><input class="cell cgstPct" value="${data.cgstPct?String(data.cgstPct).replace('%',''):''}" placeholder="e.g. 9"></td>
    <td class="cgstAmt">₹0.00</td>
    <td class="amount">₹0.00</td>
    <td><button class="del">🗑️</button></td>
  `;
  tr.querySelectorAll('input').forEach(i=> i.addEventListener('input', recalc));
  tr.querySelector('.del').addEventListener('click', ()=> { tr.remove(); recalc(); });
  itemsBody.appendChild(tr);
  recalc();
}

// escape helper
function escapeHtml(text){ return String(text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// parse %
function parsePct(v){ if(v===undefined||v==='') return 0; return parseFloat(String(v).replace('%',''))||0; }

// recalc totals
function recalc(){
  const rows = Array.from(itemsBody.querySelectorAll('tr'));
  let subtotal = 0, totalSgst=0, totalCgst=0;
  rows.forEach(r=>{
    const qty = parseFloat(r.querySelector('.qty').value)||0;
    const rate = parseFloat(r.querySelector('.rate').value)||0;
    const base = qty * rate;
    const sgstPct = parsePct(r.querySelector('.sgstPct').value);
    const cgstPct = parsePct(r.querySelector('.cgstPct').value);
    const sgstAmt = +(base * sgstPct/100);
    const cgstAmt = +(base * cgstPct/100);
    const amount = +(base);
    r.querySelector('.sgstAmt').innerText = '₹' + sgstAmt.toFixed(2);
    r.querySelector('.cgstAmt').innerText = '₹' + cgstAmt.toFixed(2);
    r.querySelector('.amount').innerText = '₹' + amount.toFixed(2);
    subtotal += base;
    totalSgst += sgstAmt;
    totalCgst += cgstAmt;
  });
  const grand = +(subtotal + totalSgst + totalCgst);
  $('subtotal').innerText = '₹' + subtotal.toFixed(2);
  $('totalSgst').innerText = '₹' + totalSgst.toFixed(2);
  $('totalCgst').innerText = '₹' + totalCgst.toFixed(2);
  $('grandTotal').innerText = '₹' + grand.toFixed(2);
  $('amountWords').innerText = numberToWords(grand);
}

// amount in words
function numberToWords(n){
  n = Math.round(n);
  if(n===0) return 'Zero Rupees Only';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
    'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function twoDigit(num){ if(num<20) return ones[num]; return tens[Math.floor(num/10)] + (num%10? ' ' + ones[num%10] : ''); }
  function threeDigit(num){ let str=''; if(num>99){ str += ones[Math.floor(num/100)] + ' Hundred'; if(num%100) str += ' and '; } if(num%100) str += twoDigit(num%100); return str; }
  let words=''; let crore = Math.floor(n/10000000); n%=10000000; let lakh = Math.floor(n/100000); n%=100000; let thousand = Math.floor(n/1000); n%=1000; let hundred = Math.floor(n/100); n%=100; let rest = Math.floor(n);
  if(crore) words += threeDigit(crore) + ' Crore ';
  if(lakh) words += threeDigit(lakh) + ' Lakh ';
  if(thousand) words += threeDigit(thousand) + ' Thousand ';
  if(hundred) words += threeDigit(hundred) + ' ';
  if(rest) words += twoDigit(rest) + ' ';
  return (words.trim() + ' Rupees Only');
}

// gather form invoice data
function getInvoiceData(){
  const rows = Array.from(itemsBody.querySelectorAll('tr')).map(r=>({
    description: r.querySelector('.desc').value||'',
    hsn: r.querySelector('.hsn').value||'',
    unit: r.querySelector('.unit').value||'',
    qty: parseFloat(r.querySelector('.qty').value)||0,
    rate: parseFloat(r.querySelector('.rate').value)||0,
    sgstPct: parsePct(r.querySelector('.sgstPct').value),
    cgstPct: parsePct(r.querySelector('.cgstPct').value)
  }));
  return {
    billNo: $('inpBillNo').value|| '',
    date: $('inpDate').value|| '',
    challan: $('inpChallan').value|| '',
    customer: $('inpCustomer').value|| '',
    address: $('inpAddress').value|| '',
    partyGst: $('inpPartyGst').value|| '',
    rows,
    createdAt: new Date().toISOString()
  };
}

// load data into form
function loadInvoiceData(data){
  $('inpBillNo').value = data.billNo||'';
  $('inpDate').value = data.date||'';
  $('inpChallan').value = data.challan||'';
  $('inpCustomer').value = data.customer||'';
  $('inpAddress').value = data.address||'';
  $('inpPartyGst').value = data.partyGst||'';
  itemsBody.innerHTML = '';
  (data.rows||[]).forEach(r=> addRow(r));
  recalc();
}

// save to history
function saveInvoiceToHistory(){
  const data = getInvoiceData();
  if(!data.billNo){ if(!confirm('No Bill No entered. Save anyway?')) return; }
  const arr = JSON.parse(localStorage.getItem(LS_INVOICES) || '[]');
  arr.unshift(data);
  localStorage.setItem(LS_INVOICES, JSON.stringify(arr));
  alert('Invoice saved to history.');
  renderHistory();
}

// save draft
function saveDraft(){
  localStorage.setItem(LS_DRAFT, JSON.stringify(getInvoiceData()));
  alert('Draft saved.');
}

// load draft
function loadDraft(){
  const raw = localStorage.getItem(LS_DRAFT);
  if(raw && confirm('Load saved draft?')) loadInvoiceData(JSON.parse(raw));
}

// history
function renderHistory(){
  invoicesList.innerHTML = '';
  const arr = JSON.parse(localStorage.getItem(LS_INVOICES) || '[]');
  if(arr.length===0){ invoicesList.innerHTML = '<div style="padding:10px;color:#555">No invoices yet.</div>'; return; }
  arr.forEach((inv, idx)=>{
    const card = document.createElement('div');
    card.className = 'invoice-card';
    const left = document.createElement('div'); left.className='meta';
    left.innerHTML = `<div><strong>Bill:</strong> ${inv.billNo || '(no)'} <small style="color:#666">${new Date(inv.createdAt).toLocaleString()}</small></div>
                      <div><strong>Customer:</strong> ${inv.customer || '-'}</div>
                      <div><strong>Grand:</strong> ${calcGrandFromData(inv)}</div>`;
    const right = document.createElement('div'); right.className='actions';
    const btnOpen = document.createElement('button'); btnOpen.innerText='Open'; btnOpen.addEventListener('click', ()=>{ loadInvoiceData(inv); showTab('invoice'); });
    const btnDownload = document.createElement('button'); btnDownload.innerText='Download'; btnDownload.addEventListener('click', ()=> generateAndDownload(inv));
    const btnDelete = document.createElement('button'); btnDelete.innerText='Delete'; btnDelete.className='secondary'; btnDelete.addEventListener('click', ()=>{ if(confirm('Delete this invoice?')){ deleteInvoiceAt(idx); renderHistory(); }});
    right.appendChild(btnOpen); right.appendChild(btnDownload); right.appendChild(btnDelete);
    card.appendChild(left); card.appendChild(right);
    invoicesList.appendChild(card);
  });
}

function deleteInvoiceAt(index){
  const arr = JSON.parse(localStorage.getItem(LS_INVOICES) || '[]'); arr.splice(index,1); localStorage.setItem(LS_INVOICES, JSON.stringify(arr));
}

function calcGrandFromData(inv){
  let subtotal=0, totalSgst=0, totalCgst=0;
  (inv.rows||[]).forEach(r=>{
    const base = (r.qty||0)*(r.rate||0);
    const sg = base * ((r.sgstPct||0)/100);
    const cg = base * ((r.cgstPct||0)/100);
    subtotal += base; totalSgst += sg; totalCgst += cg;
  });
  return '₹' + (subtotal+totalSgst+totalCgst).toFixed(2);
}

// fill hidden print template with current data
function fillPrintTemplate(data){
  // header logo
  printLogo.src = companyLogo.src;

  $('pBillNo').innerText = data.billNo || '';
  $('pDate').innerText = data.date || '';
  $('pChallan').innerText = data.challan || '';
  $('pCustomer').innerText = data.customer || '';
  $('pPartyGst').innerText = data.partyGst || '';
  $('pAddress').innerText = data.address || '';

  // items
  const pItems = $('pItemsBody'); pItems.innerHTML = '';
  let subtotal=0, totalSgst=0, totalCgst=0;
  (data.rows || []).forEach(r=>{
    const base = (r.qty||0)*(r.rate||0);
    const sg = base * ((r.sgstPct||0)/100);
    const cg = base * ((r.cgstPct||0)/100);
    const amount = base;
    subtotal += base; totalSgst += sg; totalCgst += cg;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="text-align:left;padding:6px">${escapeHtml(r.description||'')}</td>
                    <td style="text-align:center">${escapeHtml(r.hsn||'')}</td>
                    <td style="text-align:center">${r.qty||0}</td>
                    <td style="text-align:center">${escapeHtml(r.unit||'')}</td>
                    <td style="text-align:right">₹${(r.rate||0).toFixed(2)}</td>
                    <td style="text-align:right">₹${amount.toFixed(2)}</td>`;
    pItems.appendChild(tr);
  });

  const grand = subtotal + totalSgst + totalCgst;
  $('pSubtotal').innerText = '₹' + subtotal.toFixed(2);
  $('pTotalSgst').innerText = '₹' + totalSgst.toFixed(2);
  $('pTotalCgst').innerText = '₹' + totalCgst.toFixed(2);
  $('pGrandTotal').innerText = '₹' + grand.toFixed(2);
  $('pAmountWords').innerText = numberToWords(grand);
}

// generate and download PDF (data optional)
async function generateAndDownload(data){
  const using = data || getInvoiceData();
  // fill hidden template
  fillPrintTemplate(using);

  // small wait for images and layout
  await new Promise(r=>setTimeout(r,250));
  const element = document.querySelector('.print-invoice');
  // temporarily make visible for rendering
  element.classList.remove('hidden');
  // use html2canvas
  const opts = { scale:2, useCORS:true, scrollY: -window.scrollY };
  const canvas = await html2canvas(element, opts);
  const imgData = canvas.toDataURL('image/png');

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p','pt','a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const imgProps = pdf.getImageProperties(imgData);
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

  let heightLeft = pdfHeight;
  let position = 0;
  pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
  heightLeft -= pdf.internal.pageSize.getHeight();
  while (heightLeft > -1){
    position = heightLeft - pdfHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pdf.internal.pageSize.getHeight();
  }

  const fileName = `Invoice_${using.billNo || Date.now()}.pdf`;
  pdf.save(fileName);

  element.classList.add('hidden');

  // if called for current form (data undefined) auto-save
  if(!data){
    const arr = JSON.parse(localStorage.getItem(LS_INVOICES) || '[]');
    arr.unshift(getInvoiceData());
    localStorage.setItem(LS_INVOICES, JSON.stringify(arr));
    renderHistory();
    alert('✅ PDF downloaded and saved to history. Check Downloads / My Files on your phone.');
  } else {
    alert('✅ PDF downloaded. Check Downloads / My Files on your phone.');
  }
}

// logo upload
function handleLogoUpload(ev){
  const f = ev.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    companyLogo.src = e.target.result;
    printLogo.src = e.target.result;
  };
  reader.readAsDataURL(f);
}

// tab switching
function showTab(which){
  if(which==='dashboard'){
    invoiceSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    tabInvoice.classList.remove('active');
    tabDashboard.classList.add('active');
    renderHistory();
  } else {
    invoiceSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    tabInvoice.classList.add('active');
    tabDashboard.classList.remove('active');
  }
}

// render history on load
function renderHistory(){
  invoicesList.innerHTML = '';
  const arr = JSON.parse(localStorage.getItem(LS_INVOICES) || '[]');
  if(arr.length===0){ invoicesList.innerHTML = '<div style="padding:10px;color:#555">No invoices yet.</div>'; return; }
  arr.forEach((inv, idx)=>{
    const card = document.createElement('div'); card.className='invoice-card';
    const left = document.createElement('div'); left.className='meta';
    left.innerHTML = `<div><strong>Bill:</strong> ${inv.billNo || '(no)'} &nbsp; <small style="color:#666">${new Date(inv.createdAt).toLocaleString()}</small></div>
                      <div><strong>Customer:</strong> ${inv.customer || '-'}</div>
                      <div><strong>Grand:</strong> ${calcGrandFromData(inv)}</div>`;
    const right = document.createElement('div'); right.className='actions';
    const btnOpen = document.createElement('button'); btnOpen.innerText='Open'; btnOpen.addEventListener('click', ()=>{ loadInvoiceData(inv); showTab('invoice'); });
    const btnDownload = document.createElement('button'); btnDownload.innerText='Download'; btnDownload.addEventListener('click', ()=> generateAndDownload(inv));
    const btnDelete = document.createElement('button'); btnDelete.innerText='Delete'; btnDelete.className='secondary'; btnDelete.addEventListener('click', ()=>{ if(confirm('Delete this invoice?')){ deleteInvoiceAt(idx); renderHistory(); }});
    right.appendChild(btnOpen); right.appendChild(btnDownload); right.appendChild(btnDelete);
    card.appendChild(left); card.appendChild(right);
    invoicesList.appendChild(card);
  });
}

init();
