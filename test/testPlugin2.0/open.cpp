#include <emscripten.h>
#include <emscripten/bind.h>
#include "meshlab.h"

using namespace vcg;
using namespace std;
using namespace emscripten;

class Opener
{
    public:
static int openMesh(MeshLabJs &mjs, string fileName) {
    MyMesh &m=mjs.m;
    
    int loadmask;
    int ret=vcg::tri::io::Importer<MyMesh>::Open(m,fileName.c_str(),loadmask);      
    if(ret!=0) {
      printf("Error in opening file\n");
      exit(-1);
    }
    printf("Read mesh %i %i\n",m.FN(),m.VN());
    return ret;
  }
};

//Binding code
EMSCRIPTEN_BINDINGS(MeshLabJs) {
  class_<Opener>("Opener")
    .constructor<>()
    .function("openMesh",        &Opener::openMesh)
    ;
}