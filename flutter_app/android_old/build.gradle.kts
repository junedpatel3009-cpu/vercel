import org.gradle.api.tasks.Delete
import org.gradle.api.file.Directory

val newBuildDir: Directory =
    rootProject.layout.buildDirectory.dir("../../build").get()

rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    project.layout.buildDirectory.value(newBuildDir.dir(project.name))
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}