
"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatDateISO, parseISO, formatDateReadable } from '@/lib/date-utils';
import { CalendarIcon, User, Cake } from 'lucide-react';
import type { UserData } from '@/types/roaccutrack';
import { es } from 'date-fns/locale';

const userFormSchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  age: z.coerce
    .number({ invalid_type_error: "La edad debe ser un número." })
    .int({ message: "La edad debe ser un número entero." })
    .positive({ message: "La edad debe ser un número positivo." })
    .min(1, { message: "La edad debe ser al menos 1." })
    .max(120, { message: "Introduce una edad válida." })
    .nullable(),
  treatmentStartDate: z.date({
    required_error: "Por favor, selecciona una fecha.",
    invalid_type_error: "Eso no es una fecha válida.",
  }).nullable(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface UserFormProps {
  onSubmit: (data: UserData) => void;
  initialData?: UserData | null;
}

const UserForm: React.FC<UserFormProps> = ({ onSubmit, initialData }) => {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      age: initialData?.age || null,
      treatmentStartDate: initialData?.treatmentStartDate ? parseISO(initialData.treatmentStartDate) : null,
    },
  });

  const handleSubmit = (values: UserFormValues) => {
    onSubmit({
      name: values.name,
      age: values.age,
      treatmentStartDate: values.treatmentStartDate ? formatDateISO(values.treatmentStartDate) : null,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4" />Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Juan Pérez" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><Cake className="mr-2 h-4 w-4" />Edad</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Ej: 25" {...field} onChange={event => field.onChange(event.target.value === '' ? null : +event.target.value)} value={field.value === null ? '' : field.value} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="treatmentStartDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="flex items-center"><CalendarIcon className="mr-2 h-4 w-4" />Fecha de Inicio del Tratamiento</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        formatDateReadable(field.value)
                      ) : (
                        <span>Selecciona una fecha</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    locale={es}
                    mode="single"
                    selected={field.value || undefined} // Pass undefined if null
                    onSelect={(date) => field.onChange(date || null)} // Handle undefined from onSelect by passing null
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-01-01")
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>
                La fecha en que comenzaste a tomar Roacutan.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
          Guardar y Comenzar
        </Button>
      </form>
    </Form>
  );
};

export default UserForm;
