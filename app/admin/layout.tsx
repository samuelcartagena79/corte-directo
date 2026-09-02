import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata:Metadata={
  title:'CRM de órdenes | Corte Directo by Mi Casita',
  description:'Panel privado para administrar las órdenes de Corte Directo by Mi Casita.',
  robots:{index:false,follow:false},
};

export default function AdminLayout({children}:{children:React.ReactNode}){
  return children;
}
