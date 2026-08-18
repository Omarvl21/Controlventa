const STORAGE_KEY = "pegasoSistemaV2";
    const money = value => (Number(value) || 0).toFixed(2);
    const parseMoney = value => {
      let cleaned = String(value ?? "").replace(/[^\d.,-]/g, "");
      const lastComma = cleaned.lastIndexOf(",");
      const lastDot = cleaned.lastIndexOf(".");
      if (lastComma >= 0 && lastDot >= 0) {
        const decimalMark = lastComma > lastDot ? "," : ".";
        const thousandsMark = decimalMark === "," ? "." : ",";
        cleaned = cleaned.replaceAll(thousandsMark, "").replace(decimalMark, ".");
      } else if (lastComma >= 0) {
        cleaned = cleaned.replace(",", ".");
      }
      const parts = cleaned.split(".");
      const normalized = parts.length > 2 ? parts.shift() + "." + parts.join("") : cleaned;
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const today = () => new Date().toISOString().slice(0, 10);
    const parseDate = value => value ? new Date(value + "T00:00:00") : null;
    const cloneDefault = () => JSON.parse(JSON.stringify(defaultState));
    const normalizeDate = value => {
      const text = String(value || "").trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(text.slice(0, 10))) return text.slice(0, 10);
      const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const day = match[1].padStart(2, "0");
        const month = match[2].padStart(2, "0");
        return `${match[3]}-${month}-${day}`;
      }
      return today();
    };

    const defaultState = {
      config: {
        empresa: "Vestiduras Pegaso",
        telefono: "2413271794",
        direccion: "",
        facebook: "https://www.facebook.com/share/1ZDenGTzbn/",
        tiktok: "https://tiktok.com/@vestiduras.pegaso",
        folio: 1,
        agradecimiento: "Gracias por su preferencia y confianza.",
        condiciones: "Seguiremos trabajando para brindarle siempre la mejor calidad y servicio."
      },
      productos: [],
      clientes: [],
      proveedores: [],
      trabajadores: [],
      documentos: []
    };

    let state = loadState();
    normalizeState();
    let currentId = null;
    let form = emptyForm();

    function loadState() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return migrateOldState();
      try {
        const loaded = JSON.parse(raw);
        return {
          ...cloneDefault(),
          ...loaded,
          config: { ...defaultState.config, ...(loaded.config || {}) },
          productos: loaded.productos || [],
          clientes: loaded.clientes || [],
          proveedores: loaded.proveedores || [],
          trabajadores: loaded.trabajadores || [],
          documentos: loaded.documentos || []
        };
      } catch {
        return cloneDefault();
      }
    }

    function migrateOldState() {
      const next = cloneDefault();
      const oldFolio = Number(localStorage.getItem("folioPegaso"));
      if (oldFolio > 0) next.config.folio = oldFolio;
      try {
        const oldSales = JSON.parse(localStorage.getItem("ventasPegaso") || "[]");
        const clientsByName = new Map();
        oldSales.forEach(old => {
          const clientName = old.client || old.cliente || "Consumidor final";
          let client = clientsByName.get(clientName.toLowerCase());
          if (!client) {
            client = {
              id: uid(),
              nombre: clientName,
              telefono: old.whatsapp || "",
              rfc: old.rfc || "",
              direccion: ""
            };
            clientsByName.set(clientName.toLowerCase(), client);
            next.clientes.push(client);
          }
          const pagos = JSON.parse(localStorage.getItem("pagos_" + old.folio) || "[]").map(p => ({
            id: uid(),
            fecha: p.fecha || "",
            metodo: p.metodo || "Otro",
            monto: Number(p.monto) || 0
          }));
          const doc = {
            id: uid(),
            folio: old.folio || next.config.folio,
            tipo: old.tipo || "VENTA",
            fecha: normalizeDate(old.date || old.fecha),
            clienteId: client.id,
            clienteNombre: client.nombre,
            clienteTelefono: client.telefono,
            clienteRfc: client.rfc,
            clienteDireccion: "",
            items: (old.items || []).map(item => ({
              id: uid(),
              desc: item.desc || "",
              qty: Number(item.q || item.qty) || 0,
              precio: Number(item.p || item.precio) || 0,
              costo: Number(item.costo) || 0
            })),
            envio: Number(old.envio) || 0,
            notas: old.notas || "",
            pagos,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          doc.totals = calcDoc(doc);
          next.documentos.push(doc);
        });
      } catch {
        return next;
      }
      return next;
    }

    function saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function normalizeState() {
      state.config = { ...defaultState.config, ...(state.config || {}) };
      state.productos = Array.isArray(state.productos) ? state.productos : [];
      state.clientes = Array.isArray(state.clientes) ? state.clientes : [];
      state.proveedores = Array.isArray(state.proveedores) ? state.proveedores : [];
      state.trabajadores = Array.isArray(state.trabajadores) ? state.trabajadores : [];
      state.documentos = Array.isArray(state.documentos) ? state.documentos : [];
      state.documentos.forEach(doc => {
        doc.items = Array.isArray(doc.items) ? doc.items : [];
        doc.pagos = Array.isArray(doc.pagos) ? doc.pagos : [];
        doc.manoObra = Array.isArray(doc.manoObra) ? doc.manoObra : [];
        doc.totals = calcDoc(doc);
      });
      const maxFolio = state.documentos.reduce((max, doc) => Math.max(max, Number(doc.folio) || 0), 0);
      state.config.folio = Math.max(Number(state.config.folio) || 1, maxFolio + 1);
    }

    function emptyForm() {
      return {
        tipo: "VENTA",
        fecha: today(),
        clienteId: "",
        clienteNombre: "",
        clienteTelefono: "",
        clienteRfc: "",
        clienteDireccion: "",
        items: [{ id: uid(), desc: "", qty: 1, precio: 0, costo: 0, productId: "" }],
        envio: 0,
        notas: "",
        agradecimiento: "",
        condiciones: "",
        pagos: [],
        manoObra: []
      };
    }

    function calcDoc(doc = form) {
      const subtotal = doc.items.reduce((sum, item) => {
        const qty = parseMoney(item.qty) || 0;
        const basePrecio = parseMoney(item.precio) || 0;
        const precioUnitario = getItemPriceForQty(qty, item, basePrecio);
        return sum + qty * precioUnitario;
      }, 0);
      const costo = doc.items.reduce((sum, item) => sum + (parseMoney(item.qty) || 0) * (parseMoney(item.costo) || 0), 0);
      const envio = parseMoney(doc.envio);
      const manoObra = (doc.manoObra || []).reduce((sum, trabajo) => sum + parseMoney(trabajo.monto), 0);
      const total = subtotal + envio;
      const pagado = doc.pagos.reduce((sum, pago) => sum + parseMoney(pago.monto), 0);
      const saldo = Math.max(total - pagado, 0);
      const gananciaBruta = total - costo;
      const ganancia = gananciaBruta - manoObra;
      const recuperar = costo + manoObra;
      let estado = "PENDIENTE";
      if (doc.tipo === "COTIZACION") estado = "COTIZACION";
      else if (total > 0 && pagado >= total) estado = "PAGADO";
      else if (pagado > 0) estado = "PARCIAL";
      return { subtotal, costo, envio, manoObra, total, pagado, saldo, gananciaBruta, ganancia, recuperar, estado };
    }

    function getItemPriceForQty(qty, item, fallbackPrice = parseMoney(item.precio)) {
      const numericQty = parseMoney(qty) || 0;
      const basePrice = parseMoney(fallbackPrice) || 0;
      const product = state.productos.find(p => p.id === item.productId);
      if (product) {
        const mayoreoPrice = parseMoney(product.precioMayoreo || 0);
        const mayoreoPiezas = Number(product.piezasMayoreo || 0);
        if (mayoreoPrice > 0 && mayoreoPiezas > 0 && numericQty >= mayoreoPiezas) return mayoreoPrice;
        const precioVenta = parseMoney(product.precio || 0);
        if (precioVenta > 0 && numericQty > 0) return precioVenta;
      }
      if (basePrice > 0 && numericQty > 0) return basePrice;
      return 0;
    }

    function persistClientFromForm() {
      const nombre = form.clienteNombre.trim();
      if (!nombre) return "";
      let cliente = form.clienteId ? state.clientes.find(c => c.id === form.clienteId) : null;
      if (!cliente) {
        cliente = state.clientes.find(c => c.nombre.toLowerCase() === nombre.toLowerCase()) || { id: uid() };
        if (!state.clientes.some(c => c.id === cliente.id)) state.clientes.push(cliente);
      }
      Object.assign(cliente, {
        nombre,
        telefono: form.clienteTelefono.trim(),
        rfc: form.clienteRfc.trim(),
        direccion: form.clienteDireccion.trim()
      });
      form.clienteId = cliente.id;
      return cliente.id;
    }

    function buildDocument() {
      const totals = calcDoc();
      const folio = currentId ? state.documentos.find(d => d.id === currentId)?.folio : state.config.folio;
      return {
        id: currentId || uid(),
        folio,
        tipo: form.tipo,
        fecha: form.fecha,
        clienteId: form.clienteId,
        clienteNombre: form.clienteNombre.trim() || "Consumidor final",
        clienteTelefono: form.clienteTelefono.trim(),
        clienteRfc: form.clienteRfc.trim(),
        clienteDireccion: form.clienteDireccion.trim(),
        items: form.items.filter(i => i.desc.trim()).map(i => ({
          id: i.id || uid(),
          desc: i.desc.trim(),
          qty: parseMoney(i.qty),
          precio: parseMoney(i.precio),
          costo: parseMoney(i.costo),
          productId: i.productId || ""
        })),
        envio: parseMoney(form.envio),
        notas: form.notas.trim(),
        agradecimiento: form.agradecimiento.trim(),
        condiciones: form.condiciones.trim(),
        pagos: form.pagos.map(p => ({ ...p, monto: parseMoney(p.monto) })),
        manoObra: form.manoObra.filter(m => m.trabajadorId || m.nombre).map(m => ({
          id: m.id || uid(), trabajadorId: m.trabajadorId || "", nombre: m.nombre || "", puesto: m.puesto || "", monto: parseMoney(m.monto)
        })),
        totals,
        updatedAt: new Date().toISOString(),
        createdAt: currentId ? state.documentos.find(d => d.id === currentId)?.createdAt : new Date().toISOString()
      };
    }

    function saveDocument(showAlert = true) {
      if (!form.items.some(i => i.desc.trim())) {
        alert("Agrega al menos un producto o servicio.");
        return null;
      }
      persistClientFromForm();
      const doc = buildDocument();
      const idx = state.documentos.findIndex(d => d.id === doc.id);
      if (idx >= 0) state.documentos[idx] = doc;
      else {
        state.documentos.push(doc);
        state.config.folio = Number(state.config.folio) + 1;
      }
      saveState();
      currentId = doc.id;
      renderAll();
      if (showAlert) {
        const resumen = doc.tipo === "COTIZACION" ? "Cotización guardada" : "Pedido guardado";
        alert(`${resumen} con folio ${doc.folio}.\n\nMonto a recuperar: $${money(doc.totals.recuperar)}\nMano de obra por pagar: $${money(doc.totals.manoObra)}\nGanancia antes de mano de obra: $${money(doc.totals.gananciaBruta)}\nGanancia neta: $${money(doc.totals.ganancia)}`);
      }
      return doc;
    }

    function resetForm() {
      currentId = null;
      form = emptyForm();
      renderAll();
      showSection("pos");
    }

    function editDocument(id) {
      const doc = state.documentos.find(d => d.id === id);
      if (!doc) return;
      currentId = id;
      form = {
        tipo: doc.tipo,
        fecha: doc.fecha,
        clienteId: doc.clienteId || "",
        clienteNombre: doc.clienteNombre || "",
        clienteTelefono: doc.clienteTelefono || "",
        clienteRfc: doc.clienteRfc || "",
        clienteDireccion: doc.clienteDireccion || "",
        items: doc.items.map(i => ({ ...i })),
        envio: doc.envio || 0,
        notas: doc.notas || "",
        agradecimiento: doc.agradecimiento || "",
        condiciones: doc.condiciones || "",
        pagos: (doc.pagos || []).map(p => ({ ...p })),
        manoObra: (doc.manoObra || []).map(m => ({ ...m }))
      };
      renderAll();
      showSection("pos");
    }

    function deleteDocument(id) {
      const doc = state.documentos.find(d => d.id === id);
      if (!doc || !confirm("Borrar folio " + doc.folio + "?")) return;
      state.documentos = state.documentos.filter(d => d.id !== id);
      if (currentId === id) resetForm();
      saveState();
      renderAll();
    }

    function convertToSale(id) {
      const doc = state.documentos.find(d => d.id === id);
      if (!doc) return;
      doc.tipo = "VENTA";
      doc.totals = calcDoc(doc);
      doc.updatedAt = new Date().toISOString();
      saveState();
      renderAll();
    }

    function addPaymentToDocument(id) {
      const doc = state.documentos.find(d => d.id === id);
      if (!doc) return;
      const amount = parseMoney(prompt("Monto del abono para folio " + doc.folio + ":"));
      if (!amount || amount <= 0) return;
      const metodo = prompt("Metodo de pago:", "Efectivo") || "Efectivo";
      doc.pagos.push({ id: uid(), fecha: new Date().toLocaleString("es-MX"), metodo, monto: amount });
      doc.totals = calcDoc(doc);
      saveState();
      renderAll();
    }

    function renderForm() {
      document.getElementById("folioActual").textContent = currentId ? state.documentos.find(d => d.id === currentId)?.folio : state.config.folio;
      document.getElementById("formHeading").textContent = currentId ? "Editando folio " + state.documentos.find(d => d.id === currentId)?.folio : "Nueva nota de venta";
      document.getElementById("editandoAviso").textContent = currentId ? "Modo edicion: los cambios actualizaran el registro existente." : "";
      document.getElementById("tipoDocumento").value = form.tipo;
      document.getElementById("fechaDoc").value = form.fecha;
      document.getElementById("clienteNombre").value = form.clienteNombre;
      document.getElementById("clienteTelefono").value = form.clienteTelefono;
      document.getElementById("clienteRfc").value = form.clienteRfc;
      document.getElementById("clienteDireccion").value = form.clienteDireccion;
      document.getElementById("envioDoc").value = form.envio;
      document.getElementById("notasDoc").value = form.notas;
      document.getElementById("agradecimientoDoc").value = form.agradecimiento || state.config.agradecimiento || defaultState.config.agradecimiento;
      document.getElementById("condicionesDoc").value = form.condiciones || state.config.condiciones || defaultState.config.condiciones;

      const clienteSelect = document.getElementById("clienteSelect");
      clienteSelect.innerHTML = '<option value="">Seleccionar / consumidor final</option>' + state.clientes
        .slice().sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("");
      clienteSelect.value = form.clienteId || "";

      const tbody = document.querySelector("#tablaItems tbody");
      tbody.innerHTML = "";
      form.items.forEach((item, index) => {
        const qty = parseMoney(item.qty) || 0;
        const precioUnitario = getItemPriceForQty(qty, item, item.precio);
        const importe = qty * precioUnitario;
        const ganancia = importe - (qty * parseMoney(item.costo));
        const tr = document.createElement("tr");
        const productOptions = '<option value="">Sin catálogo</option>' + state.productos.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map(product => `<option value="${product.id}" ${product.id === item.productId ? "selected" : ""}>${escapeHtml(product.nombre)}${product.stockPiezas !== undefined ? ` • ${product.stockPiezas} pzs` : ""}</option>`).join("");
        tr.innerHTML = `
          <td>
            <select class="form-select form-select-sm item-product" data-index="${index}">${productOptions}</select>
            <input class="form-control form-control-sm item-desc mt-1" data-index="${index}" value="${escapeAttr(item.desc)}" placeholder="Descripcion">
          </td>
          <td><input type="text" inputmode="decimal" class="form-control form-control-sm item-qty" data-index="${index}" value="${escapeAttr(item.qty)}"></td>
          <td><input type="text" inputmode="decimal" class="form-control form-control-sm item-precio money-input" data-index="${index}" value="${escapeAttr(item.precio)}"></td>
          <td><input type="text" inputmode="decimal" class="form-control form-control-sm item-costo money-input" data-index="${index}" value="${escapeAttr(item.costo)}"></td>
          <td class="item-importe">$${money(importe)}</td>
          <td class="item-ganancia ${ganancia >= 0 ? "text-success" : "text-danger"}">$${money(ganancia)}</td>
          <td><button class="btn btn-sm btn-outline-danger" data-remove-item="${index}">X</button></td>
        `;
        tbody.appendChild(tr);
      });

      const pagosBody = document.querySelector("#tablaPagos tbody");
      pagosBody.innerHTML = "";
      form.pagos.forEach((pago, index) => {
        pagosBody.insertAdjacentHTML("beforeend", `
          <tr>
            <td>${escapeHtml(pago.fecha)}</td>
            <td>${escapeHtml(pago.metodo)}</td>
            <td>$${money(pago.monto)}</td>
            <td><button class="btn btn-sm btn-outline-danger" data-remove-pay="${index}">Borrar</button></td>
          </tr>
        `);
      });

      const manoObraBody = document.querySelector("#tablaManoObra tbody");
      manoObraBody.innerHTML = "";
      document.getElementById("sinManoObra").classList.toggle("d-none", form.manoObra.length > 0);
      document.getElementById("contenedorManoObra").classList.toggle("d-none", form.manoObra.length === 0);
      form.manoObra.forEach((trabajo, index) => {
        const options = '<option value="">Seleccionar persona</option>' + state.trabajadores
          .slice().sort((a, b) => a.nombre.localeCompare(b.nombre))
          .map(t => `<option value="${t.id}" ${t.id === trabajo.trabajadorId ? "selected" : ""}>${escapeHtml(t.nombre)}</option>`).join("");
        manoObraBody.insertAdjacentHTML("beforeend", `
          <tr>
            <td><select class="form-select form-select-sm trabajo-persona" data-index="${index}">${options}</select></td>
            <td><input class="form-control form-control-sm trabajo-actividad" data-index="${index}" value="${escapeAttr(trabajo.puesto || trabajo.actividad || "")}" placeholder="Actividad"></td>
            <td><input type="text" inputmode="decimal" class="form-control form-control-sm trabajo-monto money-input" data-index="${index}" value="${escapeAttr(trabajo.monto)}" placeholder="0.00"></td>
            <td><button class="btn btn-sm btn-outline-danger" data-remove-trabajo="${index}">X</button></td>
          </tr>
        `);
      });

      const totals = calcDoc();
      renderTotals(totals);
    }

    function renderManoObraSummary() {
      const container = document.getElementById("resumenManoObra");
      if (!container) return;
      const items = (form.manoObra || []).filter(trabajo => trabajo.trabajadorId || trabajo.nombre || trabajo.puesto || trabajo.monto);
      if (!items.length) {
        container.innerHTML = '<span class="muted">Sin pagos por persona</span>';
        return;
      }
      container.innerHTML = items.map(trabajo => {
        const nombre = trabajo.nombre || "Sin nombre";
        const actividad = trabajo.puesto || trabajo.actividad || "Sin actividad";
        return `<div>• ${escapeHtml(nombre)} — ${escapeHtml(actividad)}: $${money(trabajo.monto || 0)}</div>`;
      }).join("");
    }

    function renderTotals(totals = calcDoc()) {
      document.getElementById("subtotalDoc").textContent = money(totals.subtotal);
      document.getElementById("envioTotal").textContent = money(totals.envio);
      document.getElementById("totalDoc").textContent = money(totals.total);
      document.getElementById("pagadoDoc").textContent = money(totals.pagado);
      document.getElementById("saldoDoc").textContent = money(totals.saldo);
      document.getElementById("totalCosto").textContent = money(totals.costo);
      document.getElementById("totalManoObra").textContent = money(totals.manoObra);
      document.getElementById("totalGananciaBruta").textContent = money(totals.gananciaBruta);
      document.getElementById("totalGanancia").textContent = money(totals.ganancia);
      document.getElementById("recuperarDoc").textContent = money(totals.recuperar);
      renderManoObraSummary();
    }

    function updateRowTotals(index) {
      const row = document.querySelector(`#tablaItems tbody tr:nth-child(${Number(index) + 1})`);
      const item = form.items[Number(index)];
      if (!row || !item) return;
      const qty = parseMoney(item.qty) || 0;
      const precioUnitario = getItemPriceForQty(qty, item, item.precio);
      const importe = qty * precioUnitario;
      const ganancia = importe - (qty * parseMoney(item.costo));
      const gananciaCell = row.querySelector(".item-ganancia");
      row.querySelector(".item-importe").textContent = "$" + money(importe);
      gananciaCell.textContent = "$" + money(ganancia);
      gananciaCell.classList.toggle("text-success", ganancia >= 0);
      gananciaCell.classList.toggle("text-danger", ganancia < 0);
      renderTotals();
    }

    function renderRecords() {
      const q = document.getElementById("buscarRegistros").value.toLowerCase();
      const tipo = document.getElementById("filtroTipo").value;
      const estado = document.getElementById("filtroEstado").value;
      const tbody = document.querySelector("#tablaRegistros tbody");
      tbody.innerHTML = "";
      state.documentos
        .slice().sort((a, b) => Number(b.folio) - Number(a.folio))
        .filter(d => !tipo || d.tipo === tipo)
        .filter(d => !estado || d.totals.estado === estado)
        .filter(d => !q || [d.folio, d.clienteNombre, d.clienteTelefono].join(" ").toLowerCase().includes(q))
        .forEach(d => {
          tbody.insertAdjacentHTML("beforeend", `
            <tr>
              <td>${d.folio}</td>
              <td>${d.tipo === "COTIZACION" ? "Cotizacion" : "Venta"}</td>
              <td>${escapeHtml(d.fecha)}</td>
              <td>${escapeHtml(d.clienteNombre)}</td>
              <td>$${money(d.totals.total)}</td>
              <td>$${money(d.totals.pagado)}</td>
              <td>$${money(d.totals.saldo)}</td>
              <td><span class="status ${d.totals.estado}">${d.totals.estado}</span></td>
              <td>
                <div class="btn-group btn-group-sm">
                  <button class="btn btn-outline-light" data-edit-doc="${d.id}">Editar</button>
                  <button class="btn btn-outline-info" data-pdf-doc="${d.id}">PDF</button>
                  <button class="btn btn-outline-success" data-wa-doc="${d.id}">WhatsApp</button>
                  <button class="btn btn-outline-warning" data-pay-doc="${d.id}">Abono</button>
                  ${d.tipo === "COTIZACION" ? `<button class="btn btn-outline-primary" data-convert-doc="${d.id}">A venta</button>` : ""}
                  <button class="btn btn-outline-danger" data-delete-doc="${d.id}">Borrar</button>
                </div>
              </td>
            </tr>
          `);
        });
    }

    function clientTotals(clienteId) {
      const docs = state.documentos.filter(d => d.clienteId === clienteId && d.tipo === "VENTA");
      return docs.reduce((acc, d) => {
        acc.ventas += d.totals.total;
        acc.pagado += d.totals.pagado;
        acc.saldo += d.totals.saldo;
        acc.pendientes += d.totals.saldo > 0 ? 1 : 0;
        return acc;
      }, { ventas: 0, pagado: 0, saldo: 0, pendientes: 0 });
    }

    function renderProducts() {
      const tbody = document.querySelector("#tablaProductos tbody");
      tbody.innerHTML = "";
      state.productos.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(product => {
        tbody.insertAdjacentHTML("beforeend", `
          <tr>
            <td>${escapeHtml(product.nombre)}</td>
            <td>$${money(product.precio || 0)} / $${money(product.precioMayoreo || 0)}</td>
            <td>${escapeHtml(product.piezasMayoreo || 0)}</td>
            <td>${escapeHtml(product.cantidadContenido || 1)}</td>
            <td>${escapeHtml(product.stockPiezas || 0)}</td>
            <td>${escapeHtml(product.materialNecesario || "")}${product.materialCantidad ? ` • ${money(product.materialCantidad)}` : ""}</td>
            <td>$${money(product.costoFabricacion || 0)}</td>
            <td>
              <button class="btn btn-sm btn-outline-light" data-edit-product="${product.id}">Editar</button>
              <button class="btn btn-sm btn-outline-danger" data-delete-product="${product.id}">Borrar</button>
            </td>
          </tr>
        `);
      });
    }

    function renderClients() {
      const tbody = document.querySelector("#tablaClientes tbody");
      tbody.innerHTML = "";
      state.clientes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(c => {
        const totals = clientTotals(c.id);
        tbody.insertAdjacentHTML("beforeend", `
          <tr>
            <td>${escapeHtml(c.nombre)}</td>
            <td>${escapeHtml(c.telefono || "")}</td>
            <td>${escapeHtml(c.rfc || "")}</td>
            <td>$${money(totals.ventas)}</td>
            <td>$${money(totals.pagado)}</td>
            <td>$${money(totals.saldo)}</td>
            <td>
              <button class="btn btn-sm btn-outline-light" data-edit-client="${c.id}">Editar</button>
              <button class="btn btn-sm btn-outline-danger" data-delete-client="${c.id}">Borrar</button>
            </td>
          </tr>
        `);
      });
    }

    function renderSuppliers() {
      const tbody = document.querySelector("#tablaProveedores tbody");
      tbody.innerHTML = "";
      state.proveedores.forEach(p => {
        tbody.insertAdjacentHTML("beforeend", `
          <tr>
            <td>${escapeHtml(p.nombre)}</td>
            <td>${escapeHtml(p.telefono || "")}</td>
            <td>${escapeHtml(p.producto || "")}</td>
            <td>${escapeHtml(p.notas || "")}</td>
            <td>
              <button class="btn btn-sm btn-outline-light" data-edit-prov="${p.id}">Editar</button>
              <button class="btn btn-sm btn-outline-danger" data-delete-prov="${p.id}">Borrar</button>
            </td>
          </tr>
        `);
      });
    }

    function renderWorkers() {
      const tbody = document.querySelector("#tablaTrabajadores tbody");
      tbody.innerHTML = "";
      state.trabajadores.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(t => {
        tbody.insertAdjacentHTML("beforeend", `
          <tr><td>${escapeHtml(t.nombre)}</td><td>${escapeHtml(t.puesto || "")}</td><td>${escapeHtml(t.telefono || "")}</td><td>
            <button class="btn btn-sm btn-outline-light" data-edit-trabajador="${t.id}">Editar</button>
            <button class="btn btn-sm btn-outline-danger" data-delete-trabajador="${t.id}">Borrar</button>
          </td></tr>
        `);
      });
    }

    function renderBalances() {
      const tbody = document.querySelector("#tablaSaldos tbody");
      tbody.innerHTML = "";
      state.clientes.forEach(c => {
        const totals = clientTotals(c.id);
        if (totals.ventas === 0 && totals.saldo === 0) return;
        tbody.insertAdjacentHTML("beforeend", `
          <tr>
            <td>${escapeHtml(c.nombre)}</td>
            <td>${escapeHtml(c.telefono || "")}</td>
            <td>$${money(totals.ventas)}</td>
            <td>$${money(totals.pagado)}</td>
            <td class="text-danger fw-bold">$${money(totals.saldo)}</td>
            <td>${totals.pendientes}</td>
          </tr>
        `);
      });
    }

    function renderResults() {
      const desde = parseDate(document.getElementById("resDesde").value);
      const hasta = parseDate(document.getElementById("resHasta").value);
      const tbody = document.querySelector("#tablaResultados tbody");
      tbody.innerHTML = "";
      const docs = state.documentos.filter(d => {
        if (d.tipo !== "VENTA") return false;
        const date = parseDate(d.fecha);
        if (desde && date < desde) return false;
        if (hasta && date > hasta) return false;
        return true;
      });
      const totals = docs.reduce((acc, d) => {
        acc.ventas += d.totals.total;
        acc.cobrado += d.totals.pagado;
        acc.porCobrar += d.totals.saldo;
        acc.utilidad += d.totals.ganancia;
        acc.manoObra += d.totals.manoObra;
        acc.costo += d.totals.costo;
        return acc;
      }, { ventas: 0, cobrado: 0, porCobrar: 0, utilidad: 0, costo: 0, manoObra: 0 });

      document.getElementById("resVentas").textContent = money(totals.ventas);
      document.getElementById("resCobrado").textContent = money(totals.cobrado);
      document.getElementById("resPorCobrar").textContent = money(totals.porCobrar);
      document.getElementById("resUtilidad").textContent = money(totals.utilidad);

      docs.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).forEach(d => {
        tbody.insertAdjacentHTML("beforeend", `
          <tr>
            <td>${escapeHtml(d.fecha)}</td>
            <td>${d.folio}</td>
            <td>${escapeHtml(d.clienteNombre)}</td>
            <td>$${money(d.totals.total)}</td>
            <td>$${money(d.totals.costo)}</td>
            <td class="text-warning">$${money(d.totals.manoObra)}</td>
            <td class="${d.totals.ganancia >= 0 ? "text-success" : "text-danger"}">$${money(d.totals.ganancia)}</td>
            <td>$${money(d.totals.pagado)}</td>
            <td>$${money(d.totals.saldo)}</td>
          </tr>
        `);
      });
    }

    function renderConfig() {
      document.getElementById("cfgEmpresa").value = state.config.empresa;
      document.getElementById("cfgTelefono").value = state.config.telefono;
      document.getElementById("cfgDireccion").value = state.config.direccion;
      document.getElementById("cfgFacebook").value = state.config.facebook;
      document.getElementById("cfgTiktok").value = state.config.tiktok;
      document.getElementById("cfgFolio").value = state.config.folio;
      document.getElementById("cfgAgradecimiento").value = state.config.agradecimiento || defaultState.config.agradecimiento;
      document.getElementById("cfgCondiciones").value = state.config.condiciones || defaultState.config.condiciones;
    }

    function renderTools() {
      const ventas = state.documentos.filter(d => d.tipo === "VENTA");
      const cotizaciones = state.documentos.filter(d => d.tipo === "COTIZACION");
      const porCobrar = ventas.reduce((sum, doc) => sum + (Number(doc.totals?.saldo) || 0), 0);
      document.getElementById("toolClientes").textContent = state.clientes.length;
      document.getElementById("toolVentas").textContent = ventas.length;
      document.getElementById("toolCotizaciones").textContent = cotizaciones.length;
      document.getElementById("toolPorCobrar").textContent = money(porCobrar);
    }

    function renderAll() {
      renderForm();
      renderRecords();
      renderProducts();
      renderClients();
      renderSuppliers();
      renderWorkers();
      renderBalances();
      renderResults();
      renderConfig();
      renderTools();
    }

    function showSection(id) {
      document.querySelectorAll(".section").forEach(s => s.classList.toggle("active", s.id === id));
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.section === id));
    }

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
    }

    function escapeAttr(value) {
      return escapeHtml(value).replace(/`/g, "&#096;");
    }

    function documentHtml(doc) {
      const cfg = state.config;
      const tipo = doc.tipo === "COTIZACION" ? "NOTA DE COTIZACION" : "NOTA DE VENTA";
      const condiciones = doc.condiciones || cfg.condiciones || "";
      const agradecimiento = doc.agradecimiento || cfg.agradecimiento || "Gracias por su preferencia.";
      const rows = doc.items.map((item, index) => {
        const importe = item.qty * item.precio;
        return `<tr><td>${index + 1}</td><td>${escapeHtml(item.desc)}</td><td>${item.qty}</td><td>$${money(item.precio)}</td><td>$${money(importe)}</td></tr>`;
      }).join("");
      const pagos = (doc.pagos || []).map(p => `<div>${escapeHtml(p.fecha)} - ${escapeHtml(p.metodo)}: $${money(p.monto)}</div>`).join("") || "Sin abonos registrados";
      return `
        <div class="doc-head">
          <img class="doc-logo" src="pegaso.jpg" alt="Logo">
          <div>
            <div class="doc-title">${escapeHtml(cfg.empresa)}</div>
            <div>${escapeHtml(cfg.direccion || "")}</div>
            <div>Tel. ${escapeHtml(cfg.telefono || "")}</div>
          </div>
          <div style="text-align:right">
            <strong>${tipo}</strong><br>
            Folio: ${doc.folio}<br>
            Fecha: ${escapeHtml(doc.fecha)}
          </div>
        </div>
        <div class="doc-box">
          <strong>Cliente:</strong> ${escapeHtml(doc.clienteNombre)}<br>
          <strong>Telefono:</strong> ${escapeHtml(doc.clienteTelefono || "")}<br>
          <strong>RFC:</strong> ${escapeHtml(doc.clienteRfc || "")}<br>
          <strong>Direccion:</strong> ${escapeHtml(doc.clienteDireccion || "")}
        </div>
        <table class="doc-table">
          <thead><tr><th>#</th><th>Descripcion</th><th>Cantidad</th><th>Precio</th><th>Importe</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="doc-total">
          Subtotal: $${money(doc.totals.subtotal)}<br>
          Envio: $${money(doc.envio)}<br>
          Total: $${money(doc.totals.total)}<br>
          Pagado: $${money(doc.totals.pagado)}<br>
          Saldo: $${money(doc.totals.saldo)}
        </div>
        <div class="doc-footer">
          <div class="doc-box"><strong>Abonos</strong><br>${pagos}</div>
          <div class="doc-box"><strong>Observaciones</strong><br>${escapeHtml(doc.notas || condiciones)}</div>
        </div>
        ${doc.notas && condiciones ? `<div class="doc-box"><strong>Condiciones</strong><br>${escapeHtml(condiciones)}</div>` : ""}
        <div class="doc-qr">
          <div class="doc-qr-item"><div id="qrWhatsapp" class="doc-qr-canvas"></div><div>WhatsApp</div></div>
          <div class="doc-qr-item"><div id="qrFacebook" class="doc-qr-canvas"></div><div>Facebook</div></div>
          <div class="doc-qr-item"><div id="qrTiktok" class="doc-qr-canvas"></div><div>TikTok</div></div>
        </div>
        <div class="doc-thanks">${escapeHtml(agradecimiento)}</div>
      `;
    }

    function renderDocQrCodes(doc) {
      if (typeof QRCode === "undefined") return;
      const whatsapp = String(doc.clienteTelefono || state.config.telefono || "").replace(/\D/g, "");
      const qrData = [
        ["qrWhatsapp", whatsapp ? `https://wa.me/52${whatsapp}` : `https://wa.me/52${String(state.config.telefono || "").replace(/\D/g, "")}`],
        ["qrFacebook", state.config.facebook || "https://facebook.com"],
        ["qrTiktok", state.config.tiktok || "https://tiktok.com"]
      ];
      qrData.forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = "";
        new QRCode(el, { text, width: 72, height: 72, correctLevel: QRCode.CorrectLevel.M });
      });
    }

    function waitForQr() {
      return new Promise(resolve => setTimeout(resolve, 250));
    }

    function getPdfFileName(doc) {
      const input = document.getElementById("pdfFileName");
      const fileName = String(input?.value || "").trim();
      if (!fileName) {
        return `${doc.tipo === "COTIZACION" ? "Cotizacion_" : "Venta_"}${doc.folio}`;
      }
      return fileName.replace(/[\\/:*?"<>|]+/g, "-");
    }

    async function downloadPdf(doc, fileName) {
      const area = document.getElementById("docPreview");
      area.innerHTML = documentHtml(doc);
      renderDocQrCodes(doc);
      area.style.left = "0";
      area.style.top = "0";
      area.style.width = "794px";
      await waitForQr();
      const canvas = await html2canvas(area, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fff",
        windowWidth: area.scrollWidth,
        windowHeight: area.scrollHeight
      });
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 8;
      const marginY = 8;
      const availableWidth = pageWidth - marginX * 2;
      const availableHeight = pageHeight - marginY * 2;
      const scale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height);
      const imgWidth = canvas.width * scale;
      const imgHeight = canvas.height * scale;
      const pageHeightPx = availableHeight / scale;
      const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

      for (let page = 0; page < totalPages; page += 1) {
        if (page > 0) pdf.addPage();
        const yOffset = marginY - (page * availableHeight);
        pdf.addImage(imgData, "PNG", marginX, yOffset, imgWidth, imgHeight);
      }

      pdf.save(`${fileName}.pdf`);
      area.style.left = "-9999px";
    }

    function openWhatsAppForClient(doc) {
      const phone = String(doc.clienteTelefono || "").replace(/\D/g, "");
      const cfgPhone = String(state.config.telefono || "").replace(/\D/g, "");
      const agradecimiento = doc.agradecimiento || state.config.agradecimiento || "Gracias por su preferencia.";
      const lines = [
        `${doc.tipo === "COTIZACION" ? "Cotizacion" : "Nota de venta"} ${state.config.empresa}`,
        `Folio: ${doc.folio}`,
        `Cliente: ${doc.clienteNombre}`,
        `Total: $${money(doc.totals.total)}`,
        `Pagado: $${money(doc.totals.pagado)}`,
        `Saldo: $${money(doc.totals.saldo)}`,
        agradecimiento,
        `Contacto: ${cfgPhone}`
      ];
      if (!phone) {
        navigator.clipboard?.writeText(lines.join("\n"));
        alert("El cliente no tiene teléfono válido. El mensaje se copió al portapapeles.");
        return;
      }
      const msg = encodeURIComponent(lines.join("\n"));
      window.open(`https://wa.me/52${phone}?text=${msg}`, "_blank");
    }

    async function downloadAndMaybeSendPdf(doc) {
      const fileName = getPdfFileName(doc);
      await downloadPdf(doc, fileName);
      const shouldSend = document.getElementById("pdfSendClient")?.checked;
      if (shouldSend) {
        openWhatsAppForClient(doc);
      }
    }

    function sendWhatsApp(doc) {
      openWhatsAppForClient(doc);
    }

    function downloadTextFile(filename, content, type = "text/plain;charset=utf-8") {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function exportBackup() {
      normalizeState();
      const payload = {
        app: "Sistema Pegaso",
        version: 2,
        exportedAt: new Date().toISOString(),
        state
      };
      downloadTextFile(`respaldo-pegaso-${today()}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    }

    // Register service worker for PWA / offline support
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/assets/js/sw.js').then(reg => {
          console.log('Service worker registered.', reg.scope);
        }).catch(err => {
          console.warn('Service worker registration failed:', err);
        });
      });
    }

    function importBackupFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(String(reader.result || "{}"));
          const imported = payload.state || payload;
          if (!imported || !Array.isArray(imported.documentos)) throw new Error("Formato invalido");
          if (!confirm("Importar respaldo reemplazara los datos actuales de este navegador. Continuar?")) return;
          state = {
            ...cloneDefault(),
            ...imported,
            config: { ...defaultState.config, ...(imported.config || {}) },
            clientes: imported.clientes || [],
            proveedores: imported.proveedores || [],
            trabajadores: imported.trabajadores || [],
            documentos: imported.documentos || []
          };
          normalizeState();
          saveState();
          resetForm();
          alert("Respaldo importado correctamente.");
        } catch {
          alert("No se pudo importar el archivo. Verifica que sea un respaldo JSON valido.");
        }
      };
      reader.readAsText(file);
    }

    function csvCell(value) {
      return `"${String(value ?? "").replace(/"/g, '""')}"`;
    }

    function exportVentasCsv() {
      const headers = ["Folio", "Tipo", "Fecha", "Cliente", "Telefono", "Total", "Recuperar", "Pagado", "Saldo", "Estado", "Costo", "Mano de obra", "Ganancia neta"];
      const rows = state.documentos.map(doc => [
        doc.folio,
        doc.tipo,
        doc.fecha,
        doc.clienteNombre,
        doc.clienteTelefono,
        money(doc.totals.total),
        money(doc.totals.recuperar),
        money(doc.totals.pagado),
        money(doc.totals.saldo),
        doc.totals.estado,
        money(doc.totals.costo),
        money(doc.totals.manoObra),
        money(doc.totals.ganancia)
      ]);
      const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
      downloadTextFile(`ventas-pegaso-${today()}.csv`, csv, "text/csv;charset=utf-8");
    }

    function exportClientesCsv() {
      const headers = ["Cliente", "Telefono", "RFC", "Direccion", "Total vendido", "Pagado", "Saldo pendiente"];
      const rows = state.clientes.map(cliente => {
        const totals = clientTotals(cliente.id);
        return [cliente.nombre, cliente.telefono, cliente.rfc, cliente.direccion, money(totals.ventas), money(totals.pagado), money(totals.saldo)];
      });
      const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
      downloadTextFile(`clientes-pegaso-${today()}.csv`, csv, "text/csv;charset=utf-8");
    }

    async function printCurrentDocument() {
      const doc = saveDocument(false);
      if (!doc) return;
      const area = document.getElementById("docPreview");
      area.innerHTML = documentHtml(doc);
      renderDocQrCodes(doc);
      area.style.left = "0";
      await waitForQr();
      window.print();
      area.style.left = "-9999px";
    }

    function duplicateCurrentDocument() {
      const source = buildDocument();
      currentId = null;
      form = {
        tipo: source.tipo,
        fecha: today(),
        clienteId: source.clienteId || "",
        clienteNombre: source.clienteNombre || "",
        clienteTelefono: source.clienteTelefono || "",
        clienteRfc: source.clienteRfc || "",
        clienteDireccion: source.clienteDireccion || "",
        items: source.items.map(item => ({ ...item, id: uid() })),
        envio: source.envio || 0,
        notas: source.notas || "",
        agradecimiento: source.agradecimiento || "",
        condiciones: source.condiciones || "",
        pagos: [],
        manoObra: (source.manoObra || []).map(trabajo => ({ ...trabajo, id: uid() }))
      };
      renderAll();
      showSection("pos");
    }

    function makeQuickPaidSale() {
      const totals = calcDoc();
      if (totals.total <= 0) return alert("Agrega productos antes de marcar venta rapida.");
      form.tipo = "VENTA";
      form.pagos = [{ id: uid(), fecha: new Date().toLocaleString("es-MX"), metodo: "Efectivo", monto: totals.total }];
      saveDocument(true);
    }

    function saveProductFromPanel() {
      const id = document.getElementById("prodEditId").value || uid();
      const nombre = document.getElementById("prodNombre").value.trim();
      if (!nombre) return alert("Escribe el nombre del producto.");
      const costoFabricacion = parseMoney(document.getElementById("prodCosto").value);
      const precioVenta = parseMoney(document.getElementById("prodPrecio").value);
      const precioMayoreo = parseMoney(document.getElementById("prodPrecioMayoreo").value);
      const ganancia = parseMoney(document.getElementById("prodGanancia").value);
      const precioBase = precioVenta || (costoFabricacion > 0 && ganancia > 0 ? costoFabricacion + ganancia : 0);
      const precioMayoreoBase = precioMayoreo || precioBase || 0;
      const data = {
        id,
        nombre,
        precio: precioBase,
        precioMayoreo: precioMayoreoBase,
        piezasMayoreo: Math.max(0, Number(document.getElementById("prodPiezasMayoreo").value) || 0),
        ganancia,
        cantidadContenido: Math.max(1, Number(document.getElementById("prodContenido").value) || 1),
        stockPiezas: Math.max(0, Number(document.getElementById("prodStock").value) || 0),
        materialCantidad: parseMoney(document.getElementById("prodMaterialCantidad").value),
        materialNecesario: document.getElementById("prodMaterial").value.trim(),
        costoFabricacion,
        descripcion: document.getElementById("prodDescripcion").value.trim()
      };
      const idx = state.productos.findIndex(p => p.id === id);
      if (idx >= 0) state.productos[idx] = data;
      else state.productos.push(data);
      document.getElementById("prodEditId").value = "";
      ["prodNombre", "prodPrecio", "prodPrecioMayoreo", "prodPiezasMayoreo", "prodGanancia", "prodContenido", "prodStock", "prodMaterial", "prodMaterialCantidad", "prodCosto", "prodDescripcion"].forEach(id => document.getElementById(id).value = "");
      saveState();
      renderAll();
    }

    function saveClientFromPanel() {
      const id = document.getElementById("clienteEditId").value || uid();
      const nombre = document.getElementById("clienteFormNombre").value.trim();
      if (!nombre) return alert("Escribe el nombre del cliente.");
      const data = {
        id,
        nombre,
        telefono: document.getElementById("clienteFormTelefono").value.trim(),
        rfc: document.getElementById("clienteFormRfc").value.trim(),
        direccion: document.getElementById("clienteFormDireccion").value.trim()
      };
      const idx = state.clientes.findIndex(c => c.id === id);
      if (idx >= 0) state.clientes[idx] = data;
      else state.clientes.push(data);
      document.getElementById("clienteEditId").value = "";
      ["clienteFormNombre", "clienteFormTelefono", "clienteFormRfc", "clienteFormDireccion"].forEach(id => document.getElementById(id).value = "");
      saveState();
      renderAll();
    }

    function saveSupplier() {
      const id = document.getElementById("provEditId").value || uid();
      const nombre = document.getElementById("provNombre").value.trim();
      if (!nombre) return alert("Escribe el nombre del proveedor.");
      const data = {
        id,
        nombre,
        telefono: document.getElementById("provTelefono").value.trim(),
        producto: document.getElementById("provProducto").value.trim(),
        notas: document.getElementById("provNotas").value.trim()
      };
      const idx = state.proveedores.findIndex(p => p.id === id);
      if (idx >= 0) state.proveedores[idx] = data;
      else state.proveedores.push(data);
      document.getElementById("provEditId").value = "";
      ["provNombre", "provTelefono", "provProducto", "provNotas"].forEach(id => document.getElementById(id).value = "");
      saveState();
      renderAll();
    }

    function saveWorker() {
      const id = document.getElementById("trabajadorEditId").value || uid();
      const nombre = document.getElementById("trabajadorNombre").value.trim();
      if (!nombre) return alert("Escribe el nombre de la persona.");
      const data = {
        id,
        nombre,
        puesto: document.getElementById("trabajadorPuesto").value.trim(),
        telefono: document.getElementById("trabajadorTelefono").value.trim()
      };
      const idx = state.trabajadores.findIndex(t => t.id === id);
      if (idx >= 0) state.trabajadores[idx] = data;
      else state.trabajadores.push(data);
      document.getElementById("trabajadorEditId").value = "";
      ["trabajadorNombre", "trabajadorPuesto", "trabajadorTelefono"].forEach(id => document.getElementById(id).value = "");
      saveState();
      renderAll();
    }

    document.addEventListener("click", event => {
      const target = event.target;
      const nav = target.closest(".nav-btn");
      if (nav) showSection(nav.dataset.section);

      if (target.id === "btnAgregarProducto") {
        form.items.push({ id: uid(), desc: "", qty: 1, precio: 0, costo: 0 });
        renderForm();
      }
      if (target.id === "btnAgregarManoObra") {
        if (!state.trabajadores.length) return alert("Primero registra a una persona en la sección Mano de obra.");
        form.manoObra.push({ id: uid(), trabajadorId: "", nombre: "", puesto: "", monto: 0 });
        renderForm();
      }
      if (target.dataset.removeTrabajo) {
        form.manoObra.splice(Number(target.dataset.removeTrabajo), 1);
        renderForm();
      }
      if (target.dataset.removeItem) {
        form.items.splice(Number(target.dataset.removeItem), 1);
        if (!form.items.length) form.items.push({ id: uid(), desc: "", qty: 1, precio: 0, costo: 0 });
        renderForm();
      }
      if (target.id === "btnAgregarAbono") {
        const monto = parseMoney(document.getElementById("abonoMonto").value);
        if (!monto || monto <= 0) return alert("Ingresa un monto valido.");
        form.pagos.push({ id: uid(), fecha: new Date().toLocaleString("es-MX"), metodo: document.getElementById("abonoMetodo").value, monto });
        document.getElementById("abonoMonto").value = "";
        renderForm();
      }
      if (target.dataset.removePay) {
        form.pagos.splice(Number(target.dataset.removePay), 1);
        renderForm();
      }
      if (target.id === "btnGuardar") saveDocument(true);
      if (target.id === "btnNuevo") resetForm();
      if (target.id === "btnPdf") {
        const doc = saveDocument(false);
        if (doc) downloadAndMaybeSendPdf(doc);
      }
      if (target.id === "btnWhatsApp") {
        const doc = saveDocument(false);
        if (doc) sendWhatsApp(doc);
      }
      if (target.id === "btnClienteRapido") {
        document.getElementById("clienteFormNombre").value = form.clienteNombre;
        document.getElementById("clienteFormTelefono").value = form.clienteTelefono;
        document.getElementById("clienteFormRfc").value = form.clienteRfc;
        document.getElementById("clienteFormDireccion").value = form.clienteDireccion;
        document.getElementById("clienteEditId").value = form.clienteId;
        showSection("clientes");
      }
      if (target.id === "btnGuardarProducto") saveProductFromPanel();
      if (target.id === "btnGuardarCliente") saveClientFromPanel();
      if (target.id === "btnGuardarProveedor") saveSupplier();
      if (target.id === "btnGuardarTrabajador") saveWorker();
      if (target.id === "btnGuardarConfig") {
        state.config = {
          empresa: document.getElementById("cfgEmpresa").value.trim() || "Vestiduras Pegaso",
          telefono: document.getElementById("cfgTelefono").value.trim(),
          direccion: document.getElementById("cfgDireccion").value.trim(),
          facebook: document.getElementById("cfgFacebook").value.trim(),
          tiktok: document.getElementById("cfgTiktok").value.trim(),
          folio: Math.max(1, Number(document.getElementById("cfgFolio").value) || 1),
          agradecimiento: document.getElementById("cfgAgradecimiento").value.trim() || defaultState.config.agradecimiento,
          condiciones: document.getElementById("cfgCondiciones").value.trim() || defaultState.config.condiciones
        };
        saveState();
        renderAll();
        alert("Configuracion guardada.");
      }
      if (target.dataset.editDoc) editDocument(target.dataset.editDoc);
      if (target.dataset.deleteDoc) deleteDocument(target.dataset.deleteDoc);
      if (target.dataset.convertDoc) convertToSale(target.dataset.convertDoc);
      if (target.dataset.payDoc) addPaymentToDocument(target.dataset.payDoc);
      if (target.dataset.pdfDoc) {
        const doc = state.documentos.find(d => d.id === target.dataset.pdfDoc);
        if (doc) downloadPdf(doc);
      }
      if (target.dataset.waDoc) {
        const doc = state.documentos.find(d => d.id === target.dataset.waDoc);
        if (doc) sendWhatsApp(doc);
      }
      if (target.dataset.editProduct) {
        const p = state.productos.find(p => p.id === target.dataset.editProduct);
        if (!p) return;
        document.getElementById("prodEditId").value = p.id;
        document.getElementById("prodNombre").value = p.nombre || "";
        document.getElementById("prodPrecio").value = p.precio || "";
        document.getElementById("prodPrecioMayoreo").value = p.precioMayoreo || "";
        document.getElementById("prodPiezasMayoreo").value = p.piezasMayoreo || 0;
        document.getElementById("prodGanancia").value = p.ganancia || "";
        document.getElementById("prodContenido").value = p.cantidadContenido || 1;
        document.getElementById("prodStock").value = p.stockPiezas || 0;
        document.getElementById("prodMaterial").value = p.materialNecesario || "";
        document.getElementById("prodMaterialCantidad").value = p.materialCantidad || "";
        document.getElementById("prodCosto").value = p.costoFabricacion || "";
        document.getElementById("prodDescripcion").value = p.descripcion || "";
      }
      if (target.dataset.deleteProduct) {
        if (!confirm("Borrar producto del catalogo?")) return;
        state.productos = state.productos.filter(p => p.id !== target.dataset.deleteProduct);
        saveState();
        renderAll();
      }
      if (target.dataset.editClient) {
        const c = state.clientes.find(c => c.id === target.dataset.editClient);
        if (!c) return;
        document.getElementById("clienteEditId").value = c.id;
        document.getElementById("clienteFormNombre").value = c.nombre;
        document.getElementById("clienteFormTelefono").value = c.telefono || "";
        document.getElementById("clienteFormRfc").value = c.rfc || "";
        document.getElementById("clienteFormDireccion").value = c.direccion || "";
      }
      if (target.dataset.deleteClient) {
        if (!confirm("Borrar cliente? Sus ventas se conservaran.")) return;
        state.clientes = state.clientes.filter(c => c.id !== target.dataset.deleteClient);
        saveState();
        renderAll();
      }
      if (target.dataset.editProv) {
        const p = state.proveedores.find(p => p.id === target.dataset.editProv);
        if (!p) return;
        document.getElementById("provEditId").value = p.id;
        document.getElementById("provNombre").value = p.nombre;
        document.getElementById("provTelefono").value = p.telefono || "";
        document.getElementById("provProducto").value = p.producto || "";
        document.getElementById("provNotas").value = p.notas || "";
      }
      if (target.dataset.deleteProv) {
        if (!confirm("Borrar proveedor?")) return;
        state.proveedores = state.proveedores.filter(p => p.id !== target.dataset.deleteProv);
        saveState();
        renderAll();
      }
      if (target.dataset.editTrabajador) {
        const t = state.trabajadores.find(t => t.id === target.dataset.editTrabajador);
        if (!t) return;
        document.getElementById("trabajadorEditId").value = t.id;
        document.getElementById("trabajadorNombre").value = t.nombre;
        document.getElementById("trabajadorPuesto").value = t.puesto || "";
        document.getElementById("trabajadorTelefono").value = t.telefono || "";
      }
      if (target.dataset.deleteTrabajador) {
        if (!confirm("Borrar esta persona? Las asignaciones ya guardadas se conservarán.")) return;
        state.trabajadores = state.trabajadores.filter(t => t.id !== target.dataset.deleteTrabajador);
        saveState();
        renderAll();
      }
      if (target.id === "btnLimpiarFechas") {
        document.getElementById("resDesde").value = "";
        document.getElementById("resHasta").value = "";
        renderResults();
      }
      if (target.id === "btnExportBackup") exportBackup();
      if (target.id === "btnCsvVentas") exportVentasCsv();
      if (target.id === "btnCsvClientes") exportClientesCsv();
      if (target.id === "btnPrintDoc") printCurrentDocument();
      if (target.id === "btnDuplicarActual") duplicateCurrentDocument();
      if (target.id === "btnLimpiarFormulario") resetForm();
      if (target.id === "btnVentaRapida") makeQuickPaidSale();
    });

    document.addEventListener("input", event => {
      const t = event.target;
      if (t.id === "clienteNombre") form.clienteNombre = t.value;
      if (t.id === "clienteTelefono") form.clienteTelefono = t.value;
      if (t.id === "clienteRfc") form.clienteRfc = t.value;
      if (t.id === "clienteDireccion") form.clienteDireccion = t.value;
      if (t.id === "fechaDoc") form.fecha = t.value;
      if (t.id === "envioDoc") { form.envio = t.value; renderTotals(); }
      if (t.id === "notasDoc") form.notas = t.value;
      if (t.id === "agradecimientoDoc") form.agradecimiento = t.value;
      if (t.id === "condicionesDoc") form.condiciones = t.value;
      if (t.classList.contains("item-desc")) form.items[Number(t.dataset.index)].desc = t.value;
      if (t.classList.contains("item-product")) {
        const item = form.items[Number(t.dataset.index)];
        const product = state.productos.find(p => p.id === t.value);
        item.productId = t.value;
        if (product) {
          item.desc = product.nombre;
          item.precio = product.precio;
          item.costo = product.costoFabricacion || 0;
          renderForm();
        }
      }
      if (t.classList.contains("item-qty")) { form.items[Number(t.dataset.index)].qty = t.value; updateRowTotals(t.dataset.index); }
      if (t.classList.contains("item-precio")) { form.items[Number(t.dataset.index)].precio = t.value; updateRowTotals(t.dataset.index); }
      if (t.classList.contains("item-costo")) { form.items[Number(t.dataset.index)].costo = t.value; updateRowTotals(t.dataset.index); }
      if (t.classList.contains("trabajo-monto")) { form.manoObra[Number(t.dataset.index)].monto = t.value; renderTotals(); }
      if (t.classList.contains("trabajo-actividad")) { form.manoObra[Number(t.dataset.index)].puesto = t.value; form.manoObra[Number(t.dataset.index)].actividad = t.value; renderTotals(); }
      if (["buscarRegistros", "filtroTipo", "filtroEstado"].includes(t.id)) renderRecords();
      if (["resDesde", "resHasta"].includes(t.id)) renderResults();
    });

    document.addEventListener("change", event => {
      const t = event.target;
      if (t.classList.contains("item-qty") || t.classList.contains("item-precio") || t.classList.contains("item-costo") || t.id === "envioDoc") {
        if (t.id === "envioDoc") form.envio = parseMoney(t.value);
        if (t.classList.contains("item-qty")) form.items[Number(t.dataset.index)].qty = parseMoney(t.value);
        if (t.classList.contains("item-precio")) form.items[Number(t.dataset.index)].precio = parseMoney(t.value);
        if (t.classList.contains("item-costo")) form.items[Number(t.dataset.index)].costo = parseMoney(t.value);
        renderForm();
      }
      if (t.classList.contains("item-product")) {
        const item = form.items[Number(t.dataset.index)];
        const product = state.productos.find(p => p.id === t.value);
        item.productId = t.value;
        if (product) {
          item.desc = product.nombre;
          item.precio = product.precio;
          item.costo = product.costoFabricacion || 0;
        }
        renderForm();
      }
      if (t.classList.contains("trabajo-monto")) {
        form.manoObra[Number(t.dataset.index)].monto = parseMoney(t.value);
        renderForm();
      }
      if (t.classList.contains("trabajo-actividad")) {
        const trabajo = form.manoObra[Number(t.dataset.index)];
        trabajo.puesto = t.value;
        trabajo.actividad = t.value;
        renderForm();
      }
      if (t.classList.contains("trabajo-persona")) {
        const trabajo = form.manoObra[Number(t.dataset.index)];
        const persona = state.trabajadores.find(p => p.id === t.value);
        trabajo.trabajadorId = t.value;
        trabajo.nombre = persona?.nombre || "";
        trabajo.puesto = persona?.puesto || "";
        renderForm();
      }
      if (t.id === "tipoDocumento") { form.tipo = t.value; renderForm(); }
      if (t.id === "importBackup") {
        importBackupFile(t.files?.[0]);
        t.value = "";
      }
      if (t.id === "clienteSelect") {
        const c = state.clientes.find(c => c.id === t.value);
        form.clienteId = t.value;
        if (c) {
          form.clienteNombre = c.nombre;
          form.clienteTelefono = c.telefono || "";
          form.clienteRfc = c.rfc || "";
          form.clienteDireccion = c.direccion || "";
        }
        renderForm();
      }
    });

    renderAll();
