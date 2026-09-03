'use client';
import { SubmitEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react';
import {
  AdminOrder,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  OrderStatus,
  PaymentStatus,
} from '../../lib/orders';
import styles from './admin.module.css';
export const dynamic = 'force-static';
const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});
const dateTime = new Intl.DateTimeFormat('es-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [cashReceivable, setCashReceivable] = useState('0');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (cityFilter) params.set('city', cityFilter);
    if (deliveryFilter) params.set('deliveryDate', deliveryFilter);
    return params.toString();
  }, [statusFilter, cityFilter, deliveryFilter]);
  const loadOrders = useCallback(
    async (silent = false) => {
      try {
        const response = await fetch(
          `/api/admin/orders${query ? `?${query}` : ''}`,
          { credentials: 'include', cache: 'no-store' },
        );
        if (response.status === 401) {
          setOrders([]);
          setCashReceivable('0');
          setAuthenticated(false);
          return;
        }
        if (!response.ok) throw new Error('No fue posible cargar las órdenes.');
        const data = (await response.json()) as {
          orders: AdminOrder[];
          cashReceivable: string;
          cities: string[];
        };
        setOrders(data.orders);
        setCashReceivable(data.cashReceivable);
        setCities(data.cities);
        setLastUpdated(new Date());
        setMessage('');
        setAuthenticated(true);
      } catch (error) {
        if (!silent)
          setMessage(
            error instanceof Error
              ? error.message
              : 'No fue posible cargar las órdenes.',
          );
      }
    },
    [query],
  );
  useEffect(() => {
    fetch('/api/admin/session', { credentials: 'include', cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error();
        setAuthenticated(true);
      })
      .catch(() => setAuthenticated(false));
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    const timer = window.setTimeout(() => void loadOrders(), 200);
    return () => window.clearTimeout(timer);
  }, [authenticated, loadOrders]);
  useEffect(() => {
    if (!authenticated) return;
    const refresh = () => {
      if (!document.hidden) void loadOrders(true);
    };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [authenticated, loadOrders]);
  async function login(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/admin/session', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error || 'No fue posible iniciar sesión.');
      setBusy(false);
      return;
    }
    setAuthenticated(true);
    await loadOrders();
    setBusy(false);
  }
  async function updateOrder(
    orderId: string,
    changes: {
      orderStatus?: OrderStatus;
      paymentStatus?: PaymentStatus;
      deliveryDate?: string | null;
    },
  ) {
    setBusy(true);
    setMessage('');
    const response = await fetch('/api/admin/orders', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, ...changes }),
    });
    const data = (await response.json()) as { error?: string };
    if (response.status === 401) {
      setOrders([]);
      setCashReceivable('0');
      setAuthenticated(false);
    } else if (!response.ok)
      setMessage(data.error || 'No fue posible actualizar la orden.');
    else await loadOrders();
    setBusy(false);
  }
  async function logout() {
    await fetch('/api/admin/session', {
      method: 'DELETE',
      credentials: 'include',
    });
    setOrders([]);
    setAuthenticated(false);
  }
  if (authenticated === null)
    return <main className={styles.loading}>Verificando acceso…</main>;
  if (!authenticated)
    return (
      <main className={styles.loginPage}>
        <form className={styles.loginCard} onSubmit={login}>
          <span className={styles.mark}>CD</span>
          <p>Acceso privado</p>
          <h1>CRM de órdenes</h1>
          <label>
            Correo
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>
          <button disabled={busy} type="submit">
            <ShieldCheck size={18} />
            {busy ? 'Verificando…' : 'Entrar'}
          </button>
          {message && <output className={styles.error}>{message}</output>}
        </form>
      </main>
    );
  return (
    <main className={styles.adminPage}>
      <header className={styles.header}>
        <div>
          <span>Corte Directo by Mi Casita</span>
          <h1>Órdenes</h1>
          {lastUpdated && (
            <small>
              Actualizado{' '}
              {lastUpdated.toLocaleTimeString('es-US', {
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
              })}
            </small>
          )}
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => loadOrders()} disabled={busy}>
            <RefreshCw size={17} />
            Actualizar
          </button>
          <button onClick={logout}>
            <LogOut size={17} />
            Salir
          </button>
        </div>
      </header>
      <section className={styles.metrics}>
        <article>
          <span>Órdenes mostradas</span>
          <strong>{orders.length}</strong>
        </article>
        <article className={styles.cash}>
          <WalletCards size={24} />
          <div>
            <span>Cash por cobrar</span>
            <strong>{money.format(Number(cashReceivable))}</strong>
          </div>
        </article>
      </section>
      <section className={styles.filters}>
        <label>
          Estado
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Todos</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ciudad
          <select
            value={cityFilter}
            onChange={(event) => setCityFilter(event.target.value)}
          >
            <option value="">Todas</option>
            {cities.map((city) => (
              <option key={city}>{city}</option>
            ))}
          </select>
        </label>
        <label>
          Fecha de entrega
          <input
            type="date"
            value={deliveryFilter}
            onChange={(event) => setDeliveryFilter(event.target.value)}
          />
        </label>
        <button
          onClick={() => {
            setStatusFilter('');
            setCityFilter('');
            setDeliveryFilter('');
          }}
        >
          Limpiar filtros
        </button>
      </section>
      {message && <output className={styles.pageError}>{message}</output>}
      <section className={styles.tableCard}>
        {orders.length === 0 ? (
          <div className={styles.empty}>No hay órdenes para estos filtros.</div>
        ) : (
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr>
                  <th>Orden / Fecha</th>
                  <th>Cliente</th>
                  <th>Entrega</th>
                  <th>Productos</th>
                  <th>Total / Pago</th>
                  <th>Estado e historial</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.order_number}</strong>
                      <small>
                        {dateTime.format(new Date(order.created_at))}
                      </small>
                    </td>
                    <td>
                      <strong>{order.customer_name}</strong>
                      <a href={`tel:${order.phone}`}>{order.phone}</a>
                    </td>
                    <td>
                      <strong>
                        {order.city}, {order.zip}
                      </strong>
                      <small>{order.address}</small>
                      <label className={styles.inlineLabel}>
                        Fecha
                        <input
                          type="date"
                          disabled={busy}
                          value={order.delivery_date || ''}
                          onChange={(event) =>
                            updateOrder(order.id, {
                              deliveryDate: event.target.value || null,
                            })
                          }
                        />
                      </label>
                    </td>
                    <td>
                      {order.items.map((item) => (
                        <div className={styles.item} key={item.product_code}>
                          <strong>
                            {item.quantity} × {item.product_name}
                          </strong>
                          {Object.values(item.options)
                            .filter(Boolean)
                            .map((option) => (
                              <small key={option}>{option}</small>
                            ))}
                        </div>
                      ))}
                    </td>
                    <td>
                      <strong className={styles.total}>
                        {money.format(Number(order.total))}
                      </strong>
                      <small>
                        {PAYMENT_METHOD_LABELS[order.payment_method]}
                      </small>
                      <select
                        aria-label={`Estado de pago de ${order.order_number}`}
                        value={order.payment_status}
                        disabled={busy}
                        onChange={(event) =>
                          updateOrder(order.id, {
                            paymentStatus: event.target.value as PaymentStatus,
                          })
                        }
                      >
                        {PAYMENT_STATUSES.map((status) => (
                          <option value={status} key={status}>
                            {PAYMENT_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`Estado de orden de ${order.order_number}`}
                        value={order.order_status}
                        disabled={busy}
                        onChange={(event) =>
                          updateOrder(order.id, {
                            orderStatus: event.target.value as OrderStatus,
                          })
                        }
                      >
                        {ORDER_STATUSES.map((status) => (
                          <option value={status} key={status}>
                            {ORDER_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                      <div
                        className={styles.quickStatuses}
                        aria-label={`Cambios rápidos para ${order.order_number}`}
                      >
                        {ORDER_STATUSES.map((status) => (
                          <button
                            type="button"
                            key={status}
                            disabled={busy || order.order_status === status}
                            className={
                              order.order_status === status
                                ? styles.activeStatus
                                : undefined
                            }
                            onClick={() =>
                              updateOrder(order.id, { orderStatus: status })
                            }
                          >
                            {ORDER_STATUS_LABELS[status]}
                          </button>
                        ))}
                      </div>
                      <details className={styles.history}>
                        <summary>
                          Historial ({order.status_history.length})
                        </summary>
                        {order.status_history.map((entry) => (
                          <div key={entry.id}>
                            <strong>
                              {ORDER_STATUS_LABELS[entry.to_status]}
                            </strong>
                            <small>
                              {dateTime.format(new Date(entry.changed_at))} ·{' '}
                              {entry.changed_by === 'admin'
                                ? 'Admin'
                                : 'Sistema'}
                            </small>
                          </div>
                        ))}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
