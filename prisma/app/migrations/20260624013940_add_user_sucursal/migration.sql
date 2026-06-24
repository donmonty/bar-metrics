-- CreateTable
CREATE TABLE "user_sucursales" (
    "user_id" TEXT NOT NULL,
    "sucursal_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sucursales_pkey" PRIMARY KEY ("user_id","sucursal_id")
);

-- AddForeignKey
ALTER TABLE "user_sucursales" ADD CONSTRAINT "user_sucursales_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
