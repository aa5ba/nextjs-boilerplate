export default function Home() {
  return (
    <main style={{
      background:"#eef5ff",
      minHeight:"100vh",
      fontFamily:"system-ui",
      padding:"20px"
    }}>

      <div style={{
        background:"linear-gradient(135deg,#0d47a1,#1976d2)",
        color:"white",
        padding:"25px",
        borderRadius:"20px",
        marginBottom:"20px"
      }}>
        <h1 style={{fontSize:"28px"}}>احتساب</h1>
        <p>برنامج احتساب التمويل</p>
      </div>

      <div style={{
        background:"white",
        padding:"20px",
        borderRadius:"20px",
        maxWidth:"500px",
        margin:"auto"
      }}>

        <h2>المدخلات</h2>

        <label>صافي الراتب</label>
        <input style={{width:"100%",padding:"12px"}} />

        <label>الاستقطاعات</label>
        <input style={{width:"100%",padding:"12px"}} />

        <label>النسبة السنوية</label>
        <input style={{width:"100%",padding:"12px"}} />

        <label>مدة التمويل</label>
        <input style={{width:"100%",padding:"12px"}} />

        <button style={{
          width:"100%",
          padding:"15px",
          marginTop:"15px",
          background:"#0d47a1",
          color:"white",
          border:"none",
          borderRadius:"10px"
        }}>
          احسب النتيجة
        </button>

      </div>

    </main>
  );
}
