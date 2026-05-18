"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function FinanceContractDetailsPage() {
  const params = useParams();

  const branch = params.branch as string;
  const contractId = params.id as string;

  const [contract, setContract] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [branch, contractId]);

  async function loadData() {
    const currentBranchId = await getBranchId(branch);

    setBranchId(currentBranchId);

    if (!currentBranchId) {
      setContract(null);
      setPayments([]);
      return;
    }

    const { data: contractData } = await supabase
      .from("finance_contracts")
      .select("*, finance_customers(full_name, national_id, phone)")
      .eq("id", contractId)
      .eq("branch_id", currentBranchId)
      .single();

    const { data: paymentsData } = await supabase
      .from("finance_payments")
      .select("*")
      .eq("contract_id", contractId)
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    setContract(contractData);
    setPayments(paymentsData || []);
  }

  async function cancelPayment(payment: any) {
    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    if (payment.is_cancelled) {
      alert("تم إلغاء هذه الدفعة مسبقًا");
      return;
    }

    const confirmed = confirm("هل أنت متأكد من إلغاء الدفعة؟");
    if (!confirmed) return;

    const currentPaid = Number(contract?.paid_amount || 0);
    const debt = Number(contract?.debt_amount || 0);
    const payment
