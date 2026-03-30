export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-3">
        AI 서술형 평가 도우미
      </h1>
      <p className="text-gray-500 mb-10 text-lg">
        자동채점과 맞춤형 피드백
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <a
          href="/teacher"
          className="group block p-8 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all"
        >
          <div className="text-4xl mb-4">📝</div>
          <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 mb-2">
            교사용
          </h2>
          <p className="text-sm text-gray-500">
            서술형 평가를 설계하고 문항을 등록합니다
          </p>
        </a>

        <a
          href="/student"
          className="group block p-8 bg-white rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-lg transition-all"
        >
          <div className="text-4xl mb-4">✏️</div>
          <h2 className="text-xl font-semibold text-gray-900 group-hover:text-green-600 mb-2">
            학생용
          </h2>
          <p className="text-sm text-gray-500">
            평가 코드를 입력하고 서술형 평가를 연습합니다
          </p>
        </a>
      </div>
    </div>
  );
}
