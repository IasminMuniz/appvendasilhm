-- Tipos de papel e status
create type public.app_role as enum ('admin', 'vendedor');
create type public.order_status as enum ('pendente', 'em_andamento', 'concluido', 'cancelado');

-- Perfis de usuário
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Papéis de usuário
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Função auxiliar para verificar papel
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Clientes
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  city text,
  state text,
  notes text,
  seller_id uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all customers"
  ON public.customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can manage own customers"
  ON public.customers FOR ALL TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Produtos
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products readable by authenticated"
  ON public.products FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Products manageable by admin"
  ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Pedidos
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) NOT NULL,
  seller_id uuid REFERENCES auth.users(id) NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pendente',
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all orders"
  ON public.orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can manage own orders"
  ON public.orders FOR ALL TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Itens do pedido
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL,
  total numeric(12,2) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all order items"
  ON public.order_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can manage own order items"
  ON public.order_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
      AND orders.seller_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
      AND orders.seller_id = auth.uid()
  ));

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil e atribuir papel no cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count integer;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');

  SELECT count(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';

  IF admin_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendedor');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();